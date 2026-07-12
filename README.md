# 🚀 GrowEasy AI CSV Importer

**Turn any messy CSV into clean CRM records — automatically.**

> Built as a submission for the GrowEasy Software Developer assignment. The challenge isn't parsing CSV files — it's accepting CSVs with any column names, layouts, and structures, and accurately mapping them to CRM fields using AI.

```
📄 Any CSV  →  👀 Preview  →  🤖 AI Mapping  →  ✅ Clean CRM Records
```

---

## What It Does

Upload a spreadsheet from any source — Facebook lead exports, Google Ads, real-estate CRM dumps, manually-made spreadsheets — and the importer figures out which column maps to which CRM field, normalizes every value, and gives you a clean export.

| Feature | Detail |
|---|---|
| 🗂️ **Upload anything** | Drag-and-drop or file-picker; validates type and size (max 10 MB / 50,000 rows) client-side before anything leaves the browser |
| 🔍 **Preview before AI** | Full scrollable table of every row; blocking issues (duplicate headers, empty rows) are caught here, before any AI call |
| 🤖 **AI column mapping** | Groq (Llama 3.3 70B, Qwen3 32B fallback) reads your headers + 5 sample rows and suggests a CRM field + confidence score for every column |
| ✏️ **You stay in control** | Every AI suggestion can be overridden with a dropdown; manual overrides are stamped 100% confident |
| 📊 **Batch processing** | All rows are normalized in batches of 25 with sequential execution and 1.5 s inter-batch delay to stay within Groq rate limits |
| 🔁 **Retry + fallback** | Failed AI calls retry up to 3× (3 s base for 429s, 500 ms for other errors); if the primary model exhausts retries the fallback model is tried automatically |
| 📤 **Export results** | Final table shows imported / skipped / failed counts with search and filter; one-click export back to CSV |
| 🌗 **Dark mode** | Persisted to `localStorage` under key `groweasy-theme`; respects `prefers-color-scheme` on first visit |

---

## The 4-Step Wizard

```
① Upload ──▶ ② Preview ──▶ ③ AI Mapping ──▶ ④ Results
```

| Step | Route | What happens |
|:---:|---|---|
| **1** | `/` | Drag-and-drop or click to pick a CSV. Validated for type + size, parsed in the browser with PapaParse. No network calls. |
| **2** | `/preview` | Full data table (sticky header, horizontal + vertical scroll). Duplicate-header and empty-row checks block progression. AI hasn't touched the data yet. |
| **3** | `/mapping` | `POST /api/csv/map-columns` sends headers + 5 sample rows; AI returns a confidence-scored mapping per column. User can override any field via dropdown, then starts the import. |
| **4** | `/results` | `POST /api/csv/process` sends all rows + the confirmed mapping; AI normalizes every row in batches. Results table is searchable, filterable by status, and exportable. |

---

## Tech Stack

### Frontend (`artifacts/csv-importer/`)

| Package | Version | Purpose |
|---|---|---|
| `react` + `react-dom` | 19 | UI framework |
| `typescript` | 5.9 | Type safety |
| `vite` | 7 | Build tool and dev server |
| `wouter` | 3.3 | Lightweight client-side routing (4 routes) |
| `tailwindcss` | 4 | Utility-first styling with CSS variable tokens |
| `@tanstack/react-query` | 5 | Server state, mutation lifecycle, loading/error states |
| `@radix-ui/*` | — | Accessible component primitives (Select, Dialog, Badge, etc.) |
| `papaparse` | 5.5 | Client-side CSV parsing — runs entirely in the browser |
| `sonner` | 2 | Toast notifications |
| `lucide-react` | — | Icon library |

### Backend (`artifacts/api-server/`)

| Package | Version | Purpose |
|---|---|---|
| `express` | 5 | HTTP server |
| `typescript` | 5.9 | Type safety |
| `esbuild` | 0.27 | Bundles TypeScript to a single `dist/index.mjs` |
| `pino` + `pino-http` | 9 / 10 | Structured JSON logging (pretty in dev, JSON in prod) |
| `cors` | 2.8 | CORS headers — open in dev |
| `zod` | 3 | Runtime request body validation (via generated schemas) |

### API Contract (`lib/`)

| Package | Purpose |
|---|---|
| `lib/api-spec` | Single source of truth — `openapi.yaml` (OpenAPI 3.1) defines every request/response shape |
| `lib/api-zod` | Auto-generated Zod validators from the spec — used in Express route handlers for request parsing |
| `lib/api-client-react` | Auto-generated TanStack Query hooks (`useMapColumns`, `useProcessCsv`) — used in the React pages |

### AI

| Model | Role |
|---|---|
| `llama-3.3-70b-versatile` | Primary model for both column mapping and row normalization |
| `qwen/qwen3-32b` | Automatic fallback if the primary model fails or is rate-limited |

---

## Project Structure

Each file is expanded with the features and line ranges it contains.

---

### `artifacts/api-server/` — Express + TypeScript backend

```
artifacts/api-server/
├── build.mjs                     esbuild script — bundles src/ → dist/index.mjs (single file, ESM)
└── src/
    ├── index.ts                  (25 lines)
    │   ├── L4–10   reads PORT from env; throws immediately if missing or non-numeric
    │   └── L18–25  calls app.listen(PORT); logs "Server listening" on success, process.exit on bind error
    │
    ├── app.ts                    (57 lines)
    │   ├── L12–30  attaches pino-http request logger; scrubs Authorization header, cookies, set-cookie
    │   ├── L31–33  mounts cors(), express.json(), express.urlencoded()
    │   ├── L35     mounts all /api routes
    │   └── L42–55  single-service static serving — if csv-importer/dist/public exists (Render build),
    │               serves it as static files + SPA wildcard fallback; skipped silently on Replit
    │
    ├── routes/
    │   ├── index.ts              (10 lines) — composes healthRouter + csvRouter under /api
    │   │
    │   ├── health.ts             (11 lines)
    │   │   └── L6    GET /api/healthz → { "status": "ok" }  (used as Render health-check path)
    │   │
    │   └── csv.ts                (202 lines)
    │       ├── L9      BATCH_SIZE = 25  (rows per AI normalization call)
    │       ├── L10–15  chunk<T>()  splits any array into fixed-size batches
    │       ├── L17     INTER_BATCH_DELAY_MS = 1500  (pause injected between consecutive Groq batches)
    │       ├── L17–42  POST /api/csv/map-columns
    │       │           validates body with MapColumnsBody Zod schema → calls suggestColumnMappings()
    │       │           → returns ColumnMapping[]
    │       ├── L49–59  splitMultipleEmails()  splits "a@x.com, b@x.com" cells; first → canonical,
    │       │           extras appended to crm_note as "Additional email(s): ..."
    │       ├── L62–70  splitMultiplePhones()  same pattern; handles comma / slash / semicolon /
    │       │           "or" / "and" separators
    │       ├── L83–103 foldExtraContactsIntoNote()  runs both split functions over every raw record
    │       │           before the batch is sent to the AI
    │       ├── L105–144 POST /api/csv/process — validates body, applies columnToField mapping to
    │       │            every row to produce raw CrmRecord objects, then enters the batch loop
    │       ├── L145–165 batch loop (for...of + await — sequential, never Promise.all)
    │       │            → first-batch failure returns HTTP 500
    │       │            → subsequent-batch failures fall back to raw values for that batch only,
    │       │               so one bad batch doesn't abort the whole import
    │       │            → sleeps INTER_BATCH_DELAY_MS after each batch except the last
    │       └── L167–184 record classification
    │                    → empty row              → status: "skipped"
    │                    → no email AND no mobile → status: "failed"
    │                    → everything else        → status: "imported"
    │
    └── lib/
        ├── groq.ts               (310 lines)
        │   ├── L3–36    CRM_FIELDS (15), CRM_STATUS_VALUES (4), DATA_SOURCE_VALUES (5) — const arrays
        │   ├── L50–54   PRIMARY_MODEL = "llama-3.3-70b-versatile"
        │   │            FALLBACK_MODEL = "qwen/qwen3-32b"
        │   ├── L56–64   getApiKey() — reads GROQ_API_KEY; throws descriptive error if missing
        │   ├── L67–71   extractJson() — strips markdown fences + <think>…</think> blocks
        │   │            that some models wrap their responses in
        │   ├── L73–78   MAX_RETRY_ATTEMPTS = 3
        │   │            RETRY_BASE_DELAY_MS = 500        (5xx / timeout retries)
        │   │            RATE_LIMIT_RETRY_BASE_DELAY_MS = 3000  (429 retries — longer recovery window)
        │   ├── L81–86   isRetryableError() — matches 429 / 5xx / "rate limit" / "timeout" /
        │   │            ECONNRESET to decide whether an error warrants a retry
        │   ├── L92–136  callModel() — single Groq API call with up to 3 retries
        │   │            uses 3000 ms base delay for 429, 500 ms base for other errors,
        │   │            exponential backoff on each attempt
        │   ├── L144–162 callWithFallback() — tries primary model first; on retryable failure
        │   │            sleeps 1000 ms then tries fallback model (both share the same API-key quota,
        │   │            so the pause prevents immediately doubling the burst that caused the 429)
        │   ├── L164–228 normalizeCrmBatch() — sends batch of raw CrmRecords to AI with strict prompt
        │   │            → validates response array length matches input (no silent drops)
        │   │            → guards crm_status + data_source against hallucinated enum values
        │   │               (sets field to null if value not in allowed set)
        │   │            → falls back to the original raw record for any entry the model mangles
        │   └── L235–299 suggestColumnMappings() — sends headers + up to 5 sample rows
        │                → validates every input header appears in AI response
        │                → returns { csvColumn, crmField, confidence }[]
        │
        └── logger.ts             (20 lines)
            ├── L3      detects NODE_ENV === "production"
            └── L5–19   dev  → pino-pretty (coloured, human-readable)
                        prod → plain JSON
                        both redact: Authorization header, cookies, set-cookie response header
```

---

### `artifacts/csv-importer/` — React + Vite frontend

```
artifacts/csv-importer/
├── vite.config.ts                path aliases (@/ → src/), BASE_URL injection, dev-server proxy
└── src/
    ├── main.tsx                  (17 lines)
    │   ├── L2      imports setBaseUrl from @workspace/api-client-react
    │   └── L12–15  reads VITE_API_URL build-time env var; if present calls setBaseUrl()
    │               (only needed for split-service deploys; left unset on Replit + Render single-service)
    │
    ├── App.tsx                   (50 lines)
    │   ├── L13–17  QueryClient config — retry: 1, staleTime: 0
    │   ├── L19–35  AppShell — calls useDarkMode() on mount, renders 4 wizard routes via wouter Switch
    │   ├── L37–48  App — wraps in QueryClientProvider, ImportProvider, WouterRouter, Toaster
    │   └── L41     WouterRouter base={import.meta.env.BASE_URL} — strips trailing slash so routes
    │               work under any Vite base path
    │
    ├── index.css                 Tailwind v4 — CSS variable tokens for green palette + dark mode
    │
    ├── types/
    │   └── index.ts              (113 lines)
    │       ├── L3–20   CRM_STATUS_VALUES (4) + DATA_SOURCE_VALUES (5) — const arrays, shared with backend
    │       ├── L24–40  CrmRecord — 15 nullable string fields, mirrors OpenAPI CrmRecord schema
    │       ├── L43–59  CRM_FIELD_LABELS — human-readable label per CRM field key
    │       │           (used in mapping table headers + results table headers)
    │       ├── L63–73  ParsedCsvData — PapaParse output shape: headers, rows, previewRows (first 10),
    │       │           totalRows, filename, fileSize, delimiter, duplicateHeaders, rowErrors
    │       ├── L77–81  ColumnMapping — { csvColumn, crmField, confidence }
    │       │           shape used in Step 3 AI response AND the /process request body
    │       ├── L85–102 ProcessedRecord + ProcessStats — shapes returned by POST /api/csv/process
    │       └── L106–113 WizardStep (1|2|3|4) + STEP_LABELS
    │
    ├── context/
    │   └── ImportContext.tsx     (132 lines)
    │       ├── L18–35  ImportState interface — currentStep, file, parsedData, mappings,
    │       │           isMappingLoading, results, stats, isProcessing
    │       ├── L52–61  initialState — all null/empty, currentStep: 1
    │       ├── L69–123 ImportProvider — single useState for entire wizard state;
    │       │           all setters use useCallback + functional update to avoid stale closures
    │       ├── L103–105 reset() — restores initialState ("Start over" in ResultsPage)
    │       └── L128–132 useImport() hook — throws if called outside ImportProvider
    │
    ├── hooks/
    │   └── useDarkMode.ts        (25 lines)
    │       ├── L6–10   lazy useState initializer — reads localStorage["groweasy-theme"] first;
    │       │           falls back to prefers-color-scheme on first visit
    │       ├── L12–20  useEffect — adds/removes "dark" class on document.documentElement;
    │       │           writes preference to localStorage on every toggle
    │       └── L22     toggle — memoized with useCallback
    │
    ├── utils/
    │   └── csvUtils.ts           (237 lines)
    │       ├── L7–48   parseCsv() — two-pass PapaParse strategy
    │       │           pass 1: preview:1 reads raw header row BEFORE PapaParse auto-renames duplicates
    │       │           pass 2: full parse with header:true, skipEmptyLines:true
    │       │           → guarantees the "Duplicate headers" warning in Step 2 is accurate
    │       ├── L52–56  formatFileSize() — byte formatter: B → KB → MB
    │       ├── L82–104 SAMPLE_CSVS — metadata array for 3 downloadable sample CSVs (name, description,
    │       │           row count, delimiter, use-case)
    │       ├── L117–128 buildQuickStart() — 6 clean rows, CRM-matching headers, comma-delimited
    │       ├── L130–155 buildMessyExport() — 18 rows, non-CRM headers, multiple emails/phones per cell,
    │       │            semicolon-delimited, 2 rows with no email/phone (to exercise skip/fail logic)
    │       ├── L164–183 buildLargeBatch() — 300 rows, comma-delimited
    │       │            designed to exercise 12 consecutive AI batches of 25
    │       ├── L197–205 downloadSampleCsv() — builds selected sample CSV in memory → browser download
    │       └── L217–237 downloadResultsCsv() — serializes all ProcessedRecord[]
    │                    (rowIndex, status, reason, all 15 CRM fields) → CSV string → browser download
    │
    ├── components/
    │   ├── StepIndicator.tsx     (56 lines)
    │   │   ├── L13–15  derives isDone / isActive / isPending per step from currentStep
    │   │   └── L38–41  done steps → Check icon; active + pending steps → step number
    │   └── ui/                   Shadcn/Radix primitives (Badge, Button, Dialog, Select, Separator, …)
    │
    └── pages/
        ├── UploadPage.tsx        Step 1  (332 lines)
        │   ├── L16–17   MAX_FILE_SIZE = 10 MB; UploadError union type
        │   ├── L32–50   validateAndSetFile() — checks MIME type / .csv extension, size limit,
        │   │            duplicate detection (same name + size); fires toast on every outcome
        │   ├── L53–60   drag-and-drop handlers: onDragOver, onDragLeave, onDrop
        │   │            set isDragActive for the drop-zone highlight ring
        │   ├── L63–67   onFileInput — resets e.target.value so same file can be re-selected
        │   ├── L77–95   handleUpload() — parseCsv(file) → stores in context → navigate("/preview")
        │   ├── L110–116 dark mode toggle button in page header
        │   ├── L139–149 drop zone — role="button", tabIndex={0}, onKeyDown Enter (keyboard accessible)
        │   └── L263–313 sample CSV picker Dialog — 3 options with metadata; calls downloadSampleCsv()
        │
        ├── PreviewPage.tsx       Step 2  (413 lines)
        │   ├── L27–30   redirect guard — parsedData is null → navigate("/")
        │   ├── L36–42   issues (computed) — blocking errors: duplicate headers, empty header names,
        │   │            zero data rows; any truthy → Continue button disabled
        │   ├── L47      hasRowWarnings — non-blocking: rows with mismatched field counts from PapaParse
        │   ├── L55–65   handleContinue() — blocks if hasIssues, else navigate("/mapping")
        │   ├── L304–349 scrollable preview table — overflow-auto max-h-[560px] vertical scroll,
        │   │            min-w-full horizontal scroll, sticky thead (sticky top-0 z-10)
        │   └── L392–409 footer nav — Back → "/", Continue disabled={hasIssues}
        │
        ├── MappingPage.tsx       Step 3  (298 lines)
        │   ├── L11      imports useMapColumns from @workspace/api-client-react (generated mutation)
        │   ├── L21–33   ConfidenceBadge — ≥80% green, 50–79% amber, <50% red
        │   ├── L43–64   useMapColumns mutation — success: stores rows in local state + context,
        │   │            toast; error: toast with message
        │   ├── L74–81   runMapping() — sends { headers, sampleRows: allRows.slice(0,5) } to API
        │   ├── L85–95   useEffect (mount) — if mappings already cached in context (back-navigation),
        │   │            restores them and skips the API call
        │   ├── L97–107  sampleValuesByColumn — precomputes up to 3 sample values per header
        │   │            for the mapping table preview column
        │   ├── L109–119 handleOverride() — updates local rows state + context mappings;
        │   │            manual overrides stamped confidence: 100
        │   ├── L184–190 error state retry button → calls runMapping() again
        │   └── L208–215 "Re-run AI" button — available post-success to re-request fresh suggestions
        │
        └── ResultsPage.tsx       Step 4  (348 lines)
            ├── L11      imports useProcessCsv from @workspace/api-client-react (generated mutation)
            ├── L20–24   STATUS_META — maps RecordStatus → { label, icon, badge CSS class }
            ├── L46–60   useProcessCsv mutation — success: stores results + stats in context, toast;
            │            error: toast with message
            ├── L63–70   two redirect guards: no parsedData → "/", no mappings → "/mapping"
            ├── L72–80   runProcessing() — sends { headers, rows, userMappings } (full payload)
            ├── L84–92   useEffect (mount) — results already in context → skips API call
            ├── L94–103  filteredResults — filters by statusFilter chip; searches name + email fields
            ├── L115–118 handleExport() — downloadResultsCsv(results) + toast
            ├── L169–176 error state retry button → calls runProcessing() again
            └── L183–224 stats bar — 4 clickable cards (Total / Imported / Skipped / Failed);
                         clicking a card toggles that status as the active filter
```

---

### `lib/` — Shared API contract + generated code

```
lib/
├── api-spec/
│   ├── openapi.yaml              (235 lines) — single source of truth for all API shapes
│   │   ├── L1–93    info, servers, paths — 3 endpoints (healthz, map-columns, process)
│   │   ├── L97–102  HealthStatus schema
│   │   ├── L104–109 ErrorResponse schema
│   │   ├── L111–144 CrmRecord schema — 15 nullable string fields
│   │   ├── L145–158 ProcessedRecord schema — rowIndex, status, reason, crm: CrmRecord
│   │   ├── L159–169 ColumnMapping schema — csvColumn, crmField, confidence
│   │   ├── L170–184 ColumnMapInput schema — headers[], sampleRows[]
│   │   ├── L185–192 ColumnMapResult schema — mappings: ColumnMapping[]
│   │   ├── L194–205 CsvProcessStats schema — imported, skipped, failed, total counts
│   │   ├── L207–224 CsvProcessInput schema — headers[], rows[], userMappings[]
│   │   └── L226–235 CsvProcessResult schema — records: ProcessedRecord[], stats: CsvProcessStats
│   └── orval.config.ts           codegen config — points at openapi.yaml, outputs to api-zod + api-client-react
│
├── api-client-react/             AUTO-GENERATED — do not edit by hand
│   └── src/
│       ├── index.ts              re-exports useMapColumns, useProcessCsv, setBaseUrl
│       ├── custom-fetch.ts       fetch wrapper that reads the configurable base URL set by setBaseUrl()
│       └── generated/
│           ├── api.ts            TanStack Query useMutation hooks for both CSV endpoints
│           └── api.schemas.ts    TypeScript types derived from every OpenAPI schema
│
└── api-zod/                      AUTO-GENERATED — do not edit by hand
    └── src/
        ├── index.ts              re-exports all generated Zod schemas
        └── generated/
            └── api.ts            Zod schemas: MapColumnsBody, ProcessCsvBody, etc.
                                  used in Express route handlers for runtime request validation

► To regenerate after editing openapi.yaml:
  pnpm --filter @workspace/api-spec run codegen
```

---

## API Reference

All routes defined in `artifacts/api-server/src/routes/`. Base path: `/api`

### `GET /api/healthz`
Liveness probe. Returns `{ "status": "ok" }`.
Defined in `routes/health.ts` line 6. Used as the Render health-check path.

---

### `POST /api/csv/map-columns`
Defined in `routes/csv.ts` lines 17–42.

**Request body** (`MapColumnsBody` Zod schema):
```json
{
  "headers": ["Full Name", "Contact Email", "Phone"],
  "sampleRows": [
    { "Full Name": "John Doe", "Contact Email": "john@example.com", "Phone": "9876543210" }
  ]
}
```

**Response** (`ColumnMapResult`):
```json
{
  "mappings": [
    { "csvColumn": "Full Name",      "crmField": "name",  "confidence": 95 },
    { "csvColumn": "Contact Email",  "crmField": "email", "confidence": 98 },
    { "csvColumn": "Phone",          "crmField": "mobile_without_country_code", "confidence": 85 }
  ]
}
```

---

### `POST /api/csv/process`
Defined in `routes/csv.ts` lines 105–194.

**Request body** (`ProcessCsvBody` Zod schema):
```json
{
  "headers": ["Full Name", "Contact Email", "Phone"],
  "rows": [
    { "Full Name": "John Doe", "Contact Email": "john@example.com", "Phone": "+91 9876543210" }
  ],
  "userMappings": [
    { "csvColumn": "Full Name",     "crmField": "name",  "confidence": 95 },
    { "csvColumn": "Contact Email", "crmField": "email", "confidence": 98 },
    { "csvColumn": "Phone",         "crmField": "mobile_without_country_code", "confidence": 85 }
  ]
}
```

**Response** (`CsvProcessResult`):
```json
{
  "records": [
    {
      "rowIndex": 0,
      "status": "imported",
      "reason": null,
      "crm": {
        "name": "John Doe",
        "email": "john@example.com",
        "country_code": "+91",
        "mobile_without_country_code": "9876543210"
      }
    }
  ],
  "stats": { "imported": 1, "skipped": 0, "failed": 0, "total": 1 }
}
```

**Record statuses:**
- `imported` — has email or mobile; all fields normalized
- `skipped` — row was completely empty
- `failed` — row had data but neither email nor mobile (no way to identify the lead)

---

## OpenAPI Contract (`lib/api-spec/openapi.yaml`)

The YAML file is the single source of truth for all API types. Running the codegen script reads it and regenerates both the Zod validators and the React Query hooks:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Key schemas defined in the spec (lines 94–235):

| Schema | Lines | Used by |
|---|---|---|
| `HealthStatus` | 97–102 | `GET /api/healthz` response |
| `ErrorResponse` | 104–109 | All error responses |
| `CrmRecord` | 111–144 | 15 nullable string fields |
| `ProcessedRecord` | 145–158 | Each row in the process response |
| `ColumnMapping` | 159–169 | Map step request + response items |
| `ColumnMapInput` | 170–184 | `POST /api/csv/map-columns` request |
| `ColumnMapResult` | 185–192 | `POST /api/csv/map-columns` response |
| `CsvProcessStats` | 194–205 | Counts in the process response |
| `CsvProcessInput` | 207–224 | `POST /api/csv/process` request |
| `CsvProcessResult` | 226–235 | `POST /api/csv/process` response |

---

## Key Technical Decisions

### Two-pass CSV parsing (`csvUtils.ts` lines 7–48)
PapaParse automatically renames duplicate column headers (e.g. `"name","name"` → `"name","name_1"`) before we can inspect them. To reliably detect true duplicates, a first parse reads only the raw header row (`preview: 1`) before PapaParse transforms anything. The second pass does the full parse with `header: true`. This guarantees the "Duplicate headers" warning in Step 2 is accurate.

### Client-side parsing, server-side AI (`main.tsx` + `csvUtils.ts`)
PapaParse runs entirely in the browser — no file bytes are uploaded to the server. Only the structured JSON (headers + row objects) is sent to the backend. The AI endpoints receive text data, not file data. The backend never handles file uploads.

### Sequential batch processing with rate-limit-aware delays (`routes/csv.ts` lines 145–165, `groq.ts` lines 73–162)
The batch loop uses `for...of` + `await` (not `Promise.all`) so batches are always sequential. After each batch the loop sleeps 1.5 s (`INTER_BATCH_DELAY_MS`) to avoid saturating Groq's tokens-per-minute limit. Retry delays are differentiated: generic transient errors (5xx, timeouts) use a 500 ms base; rate-limit 429 errors use a 3 000 ms base with exponential backoff. Before trying the fallback model, `callWithFallback()` also sleeps 1 s when the failure was retryable — both models share the same API-key quota, so firing the fallback immediately after a 429 just doubles the burst.

### Enum hallucination guard (`groq.ts` lines 212–225)
After the AI returns a normalization response, `crm_status` and `data_source` are validated against the fixed allowed sets. If the model returns anything outside the set (e.g. `"Interested"` instead of `"GOOD_LEAD_FOLLOW_UP"`), the field is silently set to `null` rather than letting an invalid value reach the output.

### Single-service deployment (`app.ts` lines 42–55)
In production on Render, one Node process serves both the JSON API and the React SPA. `app.ts` checks at startup whether `artifacts/csv-importer/dist/public` exists; if it does, it serves it as static files and adds a wildcard fallback for client-side routing. On Replit this directory never exists during development (the frontend runs as its own Vite process behind the path proxy), so this block is silently skipped — the same codebase works in both environments without any branching code.

### API contract as the single source of truth (`lib/api-spec/`)
`openapi.yaml` drives everything downstream:
- `lib/api-zod/` — Zod schemas used in Express for request body validation
- `lib/api-client-react/` — TanStack Query mutations used in React pages

Editing the YAML and re-running codegen keeps both ends in sync without any manual type copying.

---

## Data Cleaning Rules

These rules run **before** AI normalization so the AI never needs to handle them:

| Rule | Where |
|---|---|
| **Multiple emails** — keep first as canonical; append extras to `crm_note` as `"Additional email(s): ..."` | `csv.ts` `splitMultipleEmails()` lines 54–59 |
| **Multiple phones** — same pattern; comma/slash/semicolon/"or"/"and" separators all handled | `csv.ts` `splitMultiplePhones()` lines 62–70 |
| **Skip rule** — rows with neither email nor mobile are marked `failed` | `csv.ts` lines 170–181 |
| **Enum guard** — `crm_status` / `data_source` outside the allowed sets → `null` | `groq.ts` lines 212–225 |
| **Date normalization** — AI converts recognizable dates to ISO 8601; unparseable strings are left unchanged | `groq.ts` prompt in `normalizeCrmBatch()` line 176 |

---

## Environment Variables

| Variable | Where read | Required | Purpose |
|---|---|---|---|
| `PORT` | `artifacts/api-server/src/index.ts` line 4 | **Yes** | Port the Express server binds to. Render sets this automatically; set it manually for local dev. |
| `GROQ_API_KEY` | `artifacts/api-server/src/lib/groq.ts` line 57 | **Yes** | Groq API key. Without it, both AI endpoints return a descriptive 500. Get one free at https://console.groq.com |
| `NODE_ENV` | `artifacts/api-server/src/lib/logger.ts` line 3 | No | `production` enables JSON logging and disables pino-pretty |
| `VITE_API_URL` | `artifacts/csv-importer/src/main.tsx` line 12 | No | Build-time override for the API base URL. Leave unset for single-service Render or Replit; set to the backend origin only if splitting frontend and backend into separate services. |

---

## Local Development

**Prerequisites:** Node.js 20+, pnpm 9+

```bash
# 1. Clone and install
git clone https://github.com/your-username/groweasy-csv-importer.git
cd groweasy-csv-importer
pnpm install

# 2. Set your Groq API key
export GROQ_API_KEY=your_key_here
# or add it to a .env file loaded by your shell

# 3. Start the backend (port 8080 by default)
PORT=8080 pnpm --filter @workspace/api-server run dev

# 4. Start the frontend (separate terminal)
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/csv-importer run dev

# 5. Regenerate API types after editing openapi.yaml
pnpm --filter @workspace/api-spec run codegen
```

Open `http://localhost:3000`. The Vite dev server proxies `/api/*` calls to Express at port 8080.

**Type-checking all packages:**
```bash
pnpm typecheck       # from repo root, checks all packages
```

---

## Deploying to Render

This app deploys as **one Render Web Service** — the Express backend serves both the JSON API (`/api/*`) and the built React SPA (everything else).

### Render Web Service settings

| Setting | Value |
|---|---|
| Root Directory | *(leave blank — repository root)* |
| Runtime | Node |
| Build Command | `pnpm install --frozen-lockfile && PORT=10000 BASE_PATH=/ pnpm --filter @workspace/csv-importer run build && pnpm --filter @workspace/api-server run build` |
| Start Command | `pnpm --filter @workspace/api-server run start` |
| Health Check Path | `/api/healthz` |

> `PORT=10000 BASE_PATH=/` in the build command are dummy values required by Vite at build time — a static build doesn't bind a port. Render injects the real `PORT` at runtime.

### Environment variables to set on Render

| Variable | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq API key |
| `NODE_ENV` | `production` |
| `PORT` | *(set automatically by Render)* |

`VITE_API_URL` is **not needed** for this single-service setup. Frontend and backend share one origin, so relative `/api/...` calls work.

### How the single-service build works

1. `pnpm --filter @workspace/csv-importer run build` → outputs static files to `artifacts/csv-importer/dist/public`
2. `pnpm --filter @workspace/api-server run build` → bundles Express to `artifacts/api-server/dist/index.mjs`
3. On boot, `app.ts` detects that `artifacts/csv-importer/dist/public` exists and serves it alongside the API (`app.ts` lines 45–55)

### Verify the deployment

```bash
curl https://your-app.onrender.com/api/healthz
# → {"status":"ok"}
```

Then open the URL and run through Upload → Preview → AI Mapping → Results end to end.

---

## CRM Fields Reference

| Field | Description | Allowed values |
|---|---|---|
| `created_at` | Lead creation date | Any ISO 8601 date/datetime |
| `name` | Lead full name | Free text |
| `email` | Primary email | Free text |
| `country_code` | Country calling code | e.g. `+91` |
| `mobile_without_country_code` | Mobile number without country code | Digits only |
| `company` | Company name | Free text |
| `city` | City | Free text |
| `state` | State / province | Free text |
| `country` | Country | Free text |
| `lead_owner` | Assigned sales rep | Free text |
| `crm_status` | Lead status | `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE` |
| `crm_note` | Notes, remarks, overflow contacts | Free text |
| `data_source` | Lead source | `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots` |
| `possession_time` | Property possession timeline | Free text / ISO date |
| `description` | Additional description | Free text |

---
