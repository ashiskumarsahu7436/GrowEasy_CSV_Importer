import { Router, type IRouter } from "express";
import { MapColumnsBody, MapColumnsResponse, ProcessCsvBody, ProcessCsvResponse } from "@workspace/api-zod";
import type { ErrorResponse } from "@workspace/api-zod";
import { suggestColumnMappings, normalizeCrmBatch, type CrmField, type RawCrmRecord } from "../lib/gemini";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const BATCH_SIZE = 25;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

router.post("/csv/map-columns", async (req, res) => {
  const parsed = MapColumnsBody.safeParse(req.body);
  if (!parsed.success) {
    const body: ErrorResponse = { error: parsed.error.issues.map((i) => i.message).join("; ") };
    res.status(400).json(body);
    return;
  }

  const { headers, sampleRows } = parsed.data;

  if (headers.length === 0) {
    const body: ErrorResponse = { error: "headers must not be empty" };
    res.status(400).json(body);
    return;
  }

  try {
    const mappings = await suggestColumnMappings(headers, sampleRows);
    res.json(MapColumnsResponse.parse({ mappings }));
  } catch (err) {
    logger.error({ err }, "AI column mapping failed");
    const message = err instanceof Error ? err.message : "AI column mapping failed";
    const body: ErrorResponse = { error: message };
    res.status(500).json(body);
  }
});

/** Fields that let us recognize/reach a lead — a record with none of these is unusable. */
const IDENTIFYING_FIELDS: CrmField[] = ["name", "email", "mobile_without_country_code"];

router.post("/csv/process", async (req, res) => {
  const parsed = ProcessCsvBody.safeParse(req.body);
  if (!parsed.success) {
    const body: ErrorResponse = { error: parsed.error.issues.map((i) => i.message).join("; ") };
    res.status(400).json(body);
    return;
  }

  const { headers, rows, userMappings } = parsed.data;

  if (headers.length === 0) {
    const body: ErrorResponse = { error: "headers must not be empty" };
    res.status(400).json(body);
    return;
  }

  // Deterministic column -> CRM field mapping supplied by the mapping step.
  const columnToField = new Map<string, CrmField>();
  for (const m of userMappings ?? []) {
    if (m.crmField) columnToField.set(m.csvColumn, m.crmField as CrmField);
  }

  const rawRecords: RawCrmRecord[] = rows.map((row) => {
    const record: RawCrmRecord = {};
    for (const [csvColumn, crmField] of columnToField.entries()) {
      const value = row[csvColumn];
      record[crmField] = value && value.trim() !== "" ? value.trim() : null;
    }
    return record;
  });

  // Normalize in batches of BATCH_SIZE. Gemini is required — if the key is
  // missing or the very first batch fails, surface a clear top-level error
  // (consistent with /csv/map-columns). A failure on a later batch instead
  // falls back to the raw, un-normalized values for just that batch so one
  // bad batch doesn't sink the whole import.
  const batches = chunk(rawRecords, BATCH_SIZE);
  const normalizedRecords: RawCrmRecord[] = new Array(rawRecords.length);
  let offset = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    try {
      const normalized = await normalizeCrmBatch(batch);
      for (let i = 0; i < batch.length; i++) {
        normalizedRecords[offset + i] = normalized[i] ?? batch[i]!;
      }
    } catch (err) {
      if (batchIndex === 0) {
        logger.error({ err }, "AI CRM normalization failed on first batch");
        const message = err instanceof Error ? err.message : "AI CRM normalization failed";
        const body: ErrorResponse = { error: message };
        res.status(500).json(body);
        return;
      }
      logger.warn({ err, batchIndex }, "AI CRM normalization failed for batch — using raw values");
      for (let i = 0; i < batch.length; i++) {
        normalizedRecords[offset + i] = batch[i]!;
      }
    }
    offset += batch.length;
  }

  const records = normalizedRecords.map((crm, rowIndex) => {
    const originalRow = rows[rowIndex] ?? {};
    const isEmptyRow = Object.values(originalRow).every((v) => !v || v.trim() === "");
    const hasIdentifyingField = IDENTIFYING_FIELDS.some((f) => crm[f]);

    if (isEmptyRow) {
      return { rowIndex, status: "skipped" as const, reason: "Empty row", crm };
    }
    if (!hasIdentifyingField) {
      return {
        rowIndex,
        status: "failed" as const,
        reason: "Missing name, email, and phone number — no way to identify this lead",
        crm,
      };
    }
    return { rowIndex, status: "imported" as const, reason: null, crm };
  });

  const stats = {
    imported: records.filter((r) => r.status === "imported").length,
    skipped: records.filter((r) => r.status === "skipped").length,
    failed: records.filter((r) => r.status === "failed").length,
    total: records.length,
  };

  res.json(ProcessCsvResponse.parse({ records, stats }));
});

export default router;
