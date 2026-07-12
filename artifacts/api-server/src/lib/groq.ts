import { logger } from "./logger";

const CRM_FIELDS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
] as const;

export type CrmField = (typeof CRM_FIELDS)[number];

const CRM_STATUS_VALUES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;

const DATA_SOURCE_VALUES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;

export interface AiColumnMapping {
  csvColumn: string;
  crmField: CrmField | null;
  confidence: number;
}

/** A raw, directly-mapped CRM record before AI normalization — all values are whatever the CSV cell contained. */
export type RawCrmRecord = Partial<Record<CrmField, string | null>>;

/** A normalized CRM record — same shape, values cleaned up (phone split, enum coercion, ISO dates). */
export type NormalizedCrmRecord = Partial<Record<CrmField, string | null>>;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Tried in order: the primary model first, then this fallback if the primary is exhausted/unavailable. */
const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "qwen/qwen3-32b";

function getApiKey(): string {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY environment variable is not set. Add it as a secret (Replit) or environment variable (Render) to enable AI-powered CSV import.",
    );
  }
  return apiKey;
}

/** Strips markdown code fences and <think>...</think> blocks some models wrap responses in. */
function extractJson(text: string): string {
  const withoutThink = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const fenced = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : withoutThink).trim();
}

const MAX_RETRY_ATTEMPTS = 3;
/** Base delay for generic transient errors (5xx, timeouts). */
const RETRY_BASE_DELAY_MS = 500;
/** Base delay when the API explicitly rate-limits us (429). Needs to be long
 *  enough for the per-minute token/request window to partially recover. */
const RATE_LIMIT_RETRY_BASE_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Transient errors worth retrying: rate limits, timeouts, and server-side hiccups. */
function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /429|500|502|503|504|rate limit|timeout|timed out|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
    message,
  );
}

/**
 * Calls a single Groq chat completion, retrying up to MAX_RETRY_ATTEMPTS
 * times with exponential backoff for transient-looking errors only.
 */
async function callModel(model: string, prompt: string): Promise<string> {
  const apiKey = getApiKey();
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Groq API error (${response.status}) for model ${model}: ${body}`);
      }

      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json.choices?.[0]?.message?.content;
      if (typeof text !== "string" || text.trim() === "") {
        throw new Error(`Groq model ${model} returned an empty response.`);
      }
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRY_ATTEMPTS || !isRetryableError(err)) throw err;
      const isRateLimit = /429|rate.?limit/i.test(
        err instanceof Error ? err.message : String(err),
      );
      const baseDelay = isRateLimit ? RATE_LIMIT_RETRY_BASE_DELAY_MS : RETRY_BASE_DELAY_MS;
      const delay = baseDelay * 2 ** (attempt - 1);
      logger.warn(
        { err, attempt, delay, model, isRateLimit },
        "Groq call failed — retrying with backoff",
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

/**
 * Calls the primary Groq model, falling back to the secondary model if the
 * primary is exhausted (retries used up) or fails outright. The fallback
 * itself is also retried on transient errors. Throws the fallback's error
 * if both models fail.
 */
async function callWithFallback(label: string, prompt: string): Promise<string> {
  try {
    return await callModel(PRIMARY_MODEL, prompt);
  } catch (err) {
    logger.warn(
      { err, label, primary: PRIMARY_MODEL, fallback: FALLBACK_MODEL },
      "Primary Groq model failed — falling back to secondary model",
    );
    // Both models share the same API-key quota. Hammering the fallback
    // immediately after a rate-limit on the primary just doubles the burst,
    // which is exactly what causes the cascade of 429s seen in the logs.
    // A short pause lets the per-minute window partially recover first.
    if (isRetryableError(err)) await sleep(1000);
    return await callModel(FALLBACK_MODEL, prompt);
  }
}

/**
 * Ask the AI to normalize a batch of directly-mapped CRM records: split
 * combined phone numbers into country_code / mobile_without_country_code,
 * coerce free-text status/data-source values into the fixed enums (or null
 * if no reasonable match), and parse dates into ISO 8601 where possible.
 * Returns records in the same order/length as the input — if the model
 * omits or mangles an entry, the caller's raw record is used as a fallback.
 */
export async function normalizeCrmBatch(
  records: RawCrmRecord[],
): Promise<NormalizedCrmRecord[]> {
  if (records.length === 0) return [];

  const prompt = `You are cleaning up CRM lead records that were directly mapped from a CSV import. Normalize each record in place — do not invent data that isn't present.

Rules:
- "crm_status" must be exactly one of: ${CRM_STATUS_VALUES.join(", ")}, or null if the input doesn't clearly match one.
- "data_source" must be exactly one of: ${DATA_SOURCE_VALUES.join(", ")}, or null if the input doesn't clearly match one.
- If "mobile_without_country_code" contains a full phone number including a country code (e.g. a leading "+91" or "91"), split it: put the country code (with leading "+") into "country_code" and the remaining local digits into "mobile_without_country_code". If "country_code" is already set separately, leave it as-is.
- "created_at" and "possession_time": if the value is a recognizable date/time, convert to ISO 8601 (YYYY-MM-DD or full timestamp). If not parseable, leave the original string unchanged.
- Trim excess whitespace from text fields. Leave fields not mentioned above unchanged.
- Preserve null values as null. Never drop a field entirely — every key present in the input record must be present in the output.

Input records (JSON array, index order matters):
${JSON.stringify(records)}

Respond with ONLY a JSON array of the same length, no prose, no markdown fences, no <think> blocks, one normalized record per input record in the same order.`;

  const raw = await callWithFallback("normalizeCrmBatch", prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (err) {
    logger.error({ err, raw }, "Failed to parse AI CRM normalization response");
    throw new Error("AI returned a response that could not be parsed as JSON.");
  }

  if (!Array.isArray(parsed) || parsed.length !== records.length) {
    logger.warn(
      { expected: records.length, got: Array.isArray(parsed) ? parsed.length : typeof parsed },
      "AI normalization response length mismatch — falling back to raw records",
    );
    return records;
  }

  return parsed.map((item, i) => {
    if (typeof item !== "object" || item === null) return records[i]!;
    const normalized: NormalizedCrmRecord = { ...records[i] };
    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      if (!CRM_FIELDS.includes(key as CrmField)) continue;
      if (value === null || typeof value === "string") {
        normalized[key as CrmField] = value;
      }
    }
    // Guard the two enum fields against hallucinated values outside the fixed set.
    if (
      normalized.crm_status !== null &&
      normalized.crm_status !== undefined &&
      !CRM_STATUS_VALUES.includes(normalized.crm_status as (typeof CRM_STATUS_VALUES)[number])
    ) {
      normalized.crm_status = records[i]!.crm_status ?? null;
    }
    if (
      normalized.data_source !== null &&
      normalized.data_source !== undefined &&
      !DATA_SOURCE_VALUES.includes(normalized.data_source as (typeof DATA_SOURCE_VALUES)[number])
    ) {
      normalized.data_source = records[i]!.data_source ?? null;
    }
    return normalized;
  });
}

/**
 * Ask the AI to suggest CRM field mappings for each CSV column, using a
 * handful of sample rows as context. Falls back to `null`/0-confidence
 * mappings for any column the model fails to address, rather than dropping it.
 */
export async function suggestColumnMappings(
  headers: string[],
  sampleRows: Record<string, string>[],
): Promise<AiColumnMapping[]> {
  const prompt = `You are mapping columns from an uploaded CSV file to a fixed set of CRM fields.

CRM fields available (use these exact keys, or null if no good match exists):
${CRM_FIELDS.join(", ")}

CSV columns: ${JSON.stringify(headers)}

Sample rows (up to 5) for context:
${JSON.stringify(sampleRows.slice(0, 5), null, 2)}

For each CSV column, return the single best-matching CRM field (or null if none fits well) and a confidence score from 0 to 100.
Respond with ONLY a JSON array, no prose, no markdown fences, no <think> blocks, in this exact shape:
[{"csvColumn": "<original column name>", "crmField": "<crm_field_key_or_null>", "confidence": <0-100>}]
Every CSV column must appear exactly once in the array.`;

  const raw = await callWithFallback("suggestColumnMappings", prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (err) {
    logger.error({ err, raw }, "Failed to parse AI column mapping response");
    throw new Error("AI returned a response that could not be parsed as JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI response was not a JSON array.");
  }

  const validFields = new Set<string>(CRM_FIELDS);
  const byColumn = new Map<string, AiColumnMapping>();

  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>)["csvColumn"] !== "string"
    ) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const csvColumn = record["csvColumn"] as string;
    const rawField = record["crmField"];
    const crmField =
      typeof rawField === "string" && validFields.has(rawField)
        ? (rawField as CrmField)
        : null;
    const rawConfidence = record["confidence"];
    const confidence =
      typeof rawConfidence === "number" && Number.isFinite(rawConfidence)
        ? Math.max(0, Math.min(100, Math.round(rawConfidence)))
        : 0;
    byColumn.set(csvColumn, { csvColumn, crmField, confidence });
  }

  // Guarantee every input header is represented, even if the model omitted it.
  return headers.map(
    (header) =>
      byColumn.get(header) ?? { csvColumn: header, crmField: null, confidence: 0 },
  );
}
