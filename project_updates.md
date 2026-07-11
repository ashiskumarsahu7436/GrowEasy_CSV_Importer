# Project Updates — GrowEasy AI CSV Importer

Track build progress prompt by prompt.

---

## Progress Overview

| Prompt | Feature | Status |
|--------|---------|--------|
| 1 | Project structure + routing | ✅ Done |
| 2 | Upload page (Step 1) | ✅ Done |
| 3 | Preview page (Step 2) | ✅ Done |
| 4 | AI Mapping page (Step 3) | ✅ Done |
| 5 | Results page (Step 4) | ✅ Done |
| 6 | Backend — `/csv/map-columns` route | ✅ Done |
| 6b | Backend — `/csv/process` route | ✅ Done |
| 7 | Gemini AI integration (column mapping) | ✅ Done |
| 7b | Gemini AI integration (batch row normalization) | ✅ Done |
| 8 | Dark mode, toasts, retry, Render deployment docs | ✅ Done |

---

## Prompt 1 — Project structure + routing ✅

**Completed:** July 10, 2026

### What was built
- Created `artifacts/csv-importer` React + Vite artifact
- Updated OpenAPI spec with CSV endpoints (`/csv/map-columns`, `/csv/process`)
- Ran codegen → generated React Query hooks + Zod validators
- Installed `papaparse`, `react-dropzone` (frontend) and `@google/generative-ai`, `multer`, `papaparse` (backend)
- Set up Tailwind CSS v4 theme matching GrowEasy design (green `#10b981`, `0.875rem` radius, Inter font)

### Files created
- `src/index.css` — theme
- `src/types/index.ts` — all TypeScript types
- `src/context/ImportContext.tsx` — wizard state
- `src/hooks/useDarkMode.ts` — dark/light toggle
- `src/components/StepIndicator.tsx` — 4-card step nav
- `src/pages/UploadPage.tsx` — stub
- `src/pages/PreviewPage.tsx` — stub
- `src/pages/MappingPage.tsx` — stub
- `src/pages/ResultsPage.tsx` — stub
- `src/App.tsx` — wouter router with 4 routes

---

## Prompt 2 — Upload page (Step 1) ✅

**Completed:** July 10, 2026

### Features implemented
- Drag-and-drop zone (native HTML events — no external dependency)
- File validation: CSV type check, 10 MB limit, duplicate detection
- Error badges: invalid type / too large / duplicate
- Success badge: "File ready"
- Selected file pill: name + size + remove button
- "Upload CSV" → PapaParse → stores `ParsedCsvData` in context → navigates to `/preview`
- Dark mode toggle (moon/sun, localStorage persist)
- Quick constraint cards, info banner, file requirements section
- Download Sample CSV button (5 rows, all CRM-relevant columns)
- Status bar: pulsing dot when file ready

### Files created / updated
- `src/pages/UploadPage.tsx` — full implementation
- `src/utils/csvUtils.ts` — `parseCsv()`, `downloadSampleCsv()`, `formatFileSize()`

---

## Prompt 3 — Preview page (Step 2) ✅

**Completed:** July 10, 2026

### Features implemented
- 3 stat cards: filename + size, rows count, columns count
- Info banner: "No AI processing happens on this screen"
- Collapsible Advanced Options: delimiter (Comma / Semicolon / Tab) + encoding (UTF-8 / UTF-16)
- Live validation: checks for duplicate headers, empty headers, zero rows — shows issues or "No issues detected"
- CSV preview table: sticky header, horizontal scroll, zebra striping, max 560px height, first 10 rows, truncated cells with title tooltip, dash for empty cells
- 3 bottom info cards: Preview ready, Instant parsing, Accessible states
- Back button → goes to `/` (Step 1)
- "Confirm & Continue" button → goes to `/mapping` (Step 3), disabled if validation issues

### Files updated
- `src/pages/PreviewPage.tsx` — full implementation

---

## Prompt 4 — AI Mapping page ✅

**Completed:** July 11, 2026

### Features implemented
- Backend: `POST /api/csv/map-columns` (`artifacts/api-server/src/routes/csv.ts`) — validates input with the generated Zod schema, calls Gemini via `lib/gemini.ts`, returns `ColumnMapping[]`. Missing `GEMINI_API_KEY` returns a clear 500 instead of crashing.
- Backend: `lib/gemini.ts` — Gemini client (`@google/generative-ai`, reads `GEMINI_API_KEY` from env, never hardcoded), prompts for column→CRM-field suggestions using headers + up to 5 sample rows, guarantees every CSV column gets a mapping entry even if the model omits one.
- Frontend: `MappingPage.tsx` — auto-runs AI mapping on mount (reusing cached mappings from context if the user navigates back), loading spinner state, error state with Retry, confidence-scored table (CSV column | sample values | AI suggested field | confidence badge | override dropdown), confidence colour coding (green ≥ 80, amber 50–79, red < 50), "Re-run AI" button, "Start Import" advances to `/results` and stores final mappings in context.
- Uses the user's own Gemini API key (not Replit's AI Integrations proxy) so it works unchanged after deploying to Render.

### Not yet built (as of Prompt 4)
- `POST /api/csv/process` (batch row extraction) and the Results page — built in Prompt 6/7, see below.

---

## Prompt 5 — Results page ✅

**Completed:** July 11, 2026

- `ResultsPage.tsx` — triggers `/api/csv/process` on mount (reuses cached results in context if navigating back), loading + error (with Retry) states, clickable stats bar (imported/skipped/failed/total — click a card to filter), search by name/email, status filter chips, full scrollable table of all 15 CRM fields + status + reason per row, "Export CSV" button, "Start over" resets context and returns to Upload.
- `downloadResultsCsv()` (`utils/csvUtils.ts`) — exports row #, status, reason, and all 15 CRM fields as a CSV file, values with commas/quotes/newlines are quoted correctly.

---

## Prompt 6 — Backend routes ✅

**Completed:** July 11, 2026

- `POST /api/csv/map-columns` — validates with Zod, calls Gemini, returns mappings (built in Prompt 4).
- `POST /api/csv/process` (`routes/csv.ts`) — builds a raw `CrmRecord` per row deterministically from `userMappings` (no AI needed for the column→field assignment itself, since that was already decided in the mapping step), batches rows 25 at a time and calls `normalizeCrmBatch` per batch, then applies deterministic status rules: empty row → `skipped`, no identifying field (name/email/phone) → `failed`, otherwise → `imported`. If the *first* batch's AI call fails (e.g. missing `GEMINI_API_KEY`), the whole request returns a clear 500; if a *later* batch fails, that batch falls back to its raw (non-normalized) values instead of failing the whole import.

---

## Prompt 7 — Gemini AI integration ✅

**Completed:** July 11, 2026

- `lib/gemini.ts` — two prompts: `suggestColumnMappings` (column mapping, Prompt 4) and `normalizeCrmBatch` (row normalization, this prompt).
- `normalizeCrmBatch`: takes an array of directly-mapped raw CRM records, asks Gemini to split combined phone numbers into `country_code` + `mobile_without_country_code`, coerce `crm_status`/`data_source` into their fixed enums (or null if no match), and parse `created_at`/`possession_time` into ISO 8601 where recognizable — leaving unparseable values untouched. Response is guarded: length mismatches or hallucinated enum values fall back to the original raw value per-field, never invented data.
- Batch size is 25 rows per Gemini call, run sequentially per `/csv/process` request.

---

## Prompt 8 — Dark mode, toasts, retry, Render deployment ✅

**Completed:** July 11, 2026

- **Dark mode** — already implemented since Prompt 3 (`hooks/useDarkMode.ts`, toggle on all 4 pages); verified consistent across the whole wizard, no changes needed.
- **Toasts** — wired up the existing shadcn/sonner `Toaster` (was mounted in `App.tsx` but unused) with `toast()` calls at key moments: file accepted/rejected/duplicate on Upload, parse success/failure, preview confirm/blocked-by-issues, AI mapping success (with mapped-column count) and failure, import processed (with imported/skipped/failed counts) and failure, and CSV export confirmation.
- **Retry** — added automatic retry with exponential backoff (`lib/gemini.ts`, `withRetry()`, up to 3 attempts) around both Gemini calls (`suggestColumnMappings`, `normalizeCrmBatch`), triggered only for transient-looking errors (429/5xx/timeouts) — permanent errors (bad key, malformed JSON) fail immediately. This sits underneath the existing manual "Retry" buttons on the Mapping/Results pages, which still work for user-initiated re-tries after fixing a config issue.
- **Render deployment** — added a full "Deploying to Render" section to `README.md`: two-service setup (backend Node Web Service + frontend static site), build/start commands, required env vars (`GEMINI_API_KEY` backend, `VITE_API_URL` frontend), CORS note, and a health-check verification step. Wired `VITE_API_URL` in `src/main.tsx` via the generated API client's `setBaseUrl()` so the frontend can reach a separately-hosted backend (Replit's path-based proxy makes this unnecessary in dev, but Render splits them into different origins).
