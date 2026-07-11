# GrowEasy AI CSV Importer

A full-stack AI-powered CSV importer that lets users upload any CSV, preview data, get AI-suggested CRM field mappings via Google Gemini, and export normalized CRM records.

---

## Architecture

```
monorepo (pnpm workspaces)
├── artifacts/
│   ├── api-server/          → Express + TypeScript backend  (API)
│   └── csv-importer/        → React + Vite frontend          (Web UI)
├── lib/
│   ├── api-spec/            → OpenAPI 3.1 contract (openapi.yaml)
│   ├── api-client-react/    → Auto-generated React Query hooks (codegen)
│   ├── api-zod/             → Auto-generated Zod validators   (codegen)
│   └── db/                  → Drizzle ORM schema (unused — app is stateless)
└── attached_assets/         → UI handoff designs (HTML/CSS/PNG)
```

### Data Flow

```
User uploads CSV
      │
      ▼
[Frontend] PapaParse parses CSV in browser
      │  headers + all rows stored in ImportContext
      ▼
[Frontend] POST /api/csv/map-columns  ← headers + 5 sample rows
      │
      ▼
[Backend] Google Gemini AI suggests column → CRM field mappings
      │  returns ColumnMapping[] with confidence scores
      ▼
[Frontend] User reviews / overrides mappings
      │
      ▼
[Frontend] POST /api/csv/process  ← headers + all rows + final mappings
      │
      ▼
[Backend] Gemini AI extracts + normalizes each row → CrmRecord
      │  batch processing (25 rows/batch), retries on failure
      ▼
[Frontend] Results table with filter/search + CSV export
```

---

## How the 4-step wizard works

| Step | Route      | What happens |
|------|------------|--------------|
| 1    | `/`        | Drag-and-drop or click to pick a CSV file. Client validates type (CSV only) and size (max 10 MB). PapaParse parses on "Upload CSV" click. |
| 2    | `/preview` | Full scrollable table of all rows (first 10 shown), row/column counts, delimiter detected. User confirms before AI runs. |
| 3    | `/mapping` | AI analyses headers + 5 sample rows → confidence-scored mapping table. User can override any mapping via dropdown. "Start Import" triggers batch processing. |
| 4    | `/results` | Processed CRM records table. Stats bar (imported / skipped / failed). Filter by status, search by name/email. Export to CSV button. |

---

## File Reference

### Frontend — `artifacts/csv-importer/src/`

| File / Folder | Purpose |
|---|---|
| `main.tsx` | React entry point. Also wires `VITE_API_URL` → `setBaseUrl()` for Render deployments (see "Deploying to Render" below). |
| `App.tsx` | QueryClientProvider + ImportProvider + WouterRouter + 4 routes |
| `index.css` | Tailwind v4 theme — green `#10b981` palette, HSL CSS variables, dark mode |
| **`types/index.ts`** | All TypeScript types: `CrmRecord`, `ColumnMapping`, `ParsedCsvData`, `ProcessedRecord`, `WizardStep`, etc. |
| **`context/ImportContext.tsx`** | React context holding the entire wizard state — file, parsedData, mappings, results, stats. Shared across all 4 pages. |
| **`hooks/useDarkMode.ts`** | Reads/writes dark mode from localStorage, adds/removes `.dark` class on `<html>`. |
| **`utils/csvUtils.ts`** | `parseCsv()` — PapaParse wrapper returning `ParsedCsvData`. `downloadSampleCsv()` — generates and downloads a sample CSV. `formatFileSize()` — bytes → human-readable. |
| **`components/StepIndicator.tsx`** | 4-card step progress bar shown on every page. Active step gets green ring. Completed steps show a checkmark. |
| **`pages/UploadPage.tsx`** | Step 1 — react-dropzone drop zone, file validation, error badges, info banner, requirements card, sample CSV download. |
| **`pages/PreviewPage.tsx`** | Step 2 — scrollable data table, column/row stats, delimiter info, confirm button. *(Prompt 3)* |
| **`pages/MappingPage.tsx`** | Step 3 — AI mapping progress, confidence score table, override dropdowns, "Start Import" button. *(Prompt 4)* |
| **`pages/ResultsPage.tsx`** | Step 4 — results table, stats bar, filter/search, export CSV. *(Prompt 5)* |

### Backend — `artifacts/api-server/src/`

| File / Folder | Purpose |
|---|---|
| `index.ts` | Starts Express server on `$PORT` |
| `app.ts` | Mounts CORS, JSON body parser, pino-http logger, `/api` router |
| `routes/index.ts` | Root router — registers all sub-routers |
| `routes/health.ts` | `GET /api/healthz` — liveness probe |
| `routes/csv.ts` | `POST /api/csv/map-columns` and `POST /api/csv/process` *(Prompt 6)* |
| `lib/logger.ts` | Pino structured logger (pretty in dev, JSON in prod) |
| `lib/gemini.ts` | Gemini AI client — column mapping + batch row extraction *(Prompt 6)* |

### API Contract — `lib/api-spec/openapi.yaml`

Single source of truth. Run `pnpm --filter @workspace/api-spec run codegen` after changes.

Key endpoints:

| Method | Path | Description |
|---|---|---|
| GET | `/api/healthz` | Health check |
| POST | `/api/csv/map-columns` | AI column mapping (headers + sample rows → ColumnMapping[]) |
| POST | `/api/csv/process` | Batch AI extraction (headers + all rows → ProcessedRecord[]) |

### CRM Fields (15 total)

`created_at`, `name`, `email`, `country_code`, `mobile_without_country_code`, `company`, `city`, `state`, `country`, `lead_owner`, `crm_status`, `crm_note`, `data_source`, `possession_time`, `description`

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, wouter, TanStack Query |
| CSV Parsing | PapaParse (client-side) |
| Drag & Drop | react-dropzone |
| AI | Google Gemini (`@google/generative-ai`) |
| Backend | Express 5, TypeScript, pino |
| API Contract | OpenAPI 3.1 → Orval codegen |
| Package Manager | pnpm workspaces |

---

## UX features

- **Dark mode** — toggle in the header on every page (`hooks/useDarkMode.ts`). Persists to `localStorage`, falls back to the OS preference on first visit, and applies instantly via a `.dark` class on `<html>` (no flash/reload).
- **Toast notifications** — every meaningful action surfaces a toast (top-right, via `sonner`/shadcn `Toaster` mounted in `App.tsx`): file accepted/rejected, CSV parsed, AI mapping succeeded/failed, import processed with counts, CSV export confirmation. Toasts complement (never replace) the inline error/empty states already on each page.
- **Retry** — two layers:
  - *Automatic*: the backend (`lib/gemini.ts`) retries a failed Gemini call up to 3 times with exponential backoff, but only for transient-looking errors (429/5xx/timeouts) — a bad API key or malformed AI response fails immediately instead of retrying uselessly.
  - *Manual*: the Mapping and Results pages show a "Retry" button on failure so the user can re-trigger the request themselves (e.g. after fixing `GEMINI_API_KEY` or the AI service recovering).

---

## Local Development

```bash
# Install all dependencies
pnpm install

# Start frontend (auto-restarts)
pnpm --filter @workspace/csv-importer run dev

# Start backend
pnpm --filter @workspace/api-server run dev

# Re-run codegen after openapi.yaml changes
pnpm --filter @workspace/api-spec run codegen
```

---

## Deploying to Render

This app deploys as **one Render service**. The Express backend (`api-server`) serves both the JSON API (under `/api`) and the built React frontend (everything else, with client-side routing fallback to `index.html`) from a single Node process — see `artifacts/api-server/src/app.ts`. Render doesn't know about the pnpm workspace layout by default, so the build command below builds the frontend first, then the backend, from the repo root.

### Render "Web Service" settings

| Setting | Value |
|---|---|
| Root Directory | repository root (leave blank) |
| Runtime | Node |
| Build Command | `pnpm install --frozen-lockfile && PORT=10000 BASE_PATH=/ pnpm --filter @workspace/csv-importer run build && pnpm --filter @workspace/api-server run build` |
| Start Command | `pnpm --filter @workspace/api-server run start` |
| Health Check Path | `/api/healthz` |

`PORT=10000 BASE_PATH=/` in the build command are dummy build-time values only — Vite's config validates that they're set, but a static build doesn't actually bind to that port. The real runtime port comes from Render's own `PORT` env var, injected at start time.

**Environment variables:**
- `GEMINI_API_KEY` — your Google Gemini API key (required — without it, `/api/csv/map-columns` and `/api/csv/process` return a clear 500 instead of crashing).
- `PORT` — Render sets this automatically at runtime; the server already reads `process.env.PORT`.
- `NODE_ENV=production`

You do **not** need `VITE_API_URL` for this single-service setup — frontend and backend share one origin, so the frontend's relative `/api/...` calls just work. (`VITE_API_URL` only exists as an escape hatch in `src/main.tsx` if you ever choose to split the two into separate services later.)

### How it works

- `pnpm --filter @workspace/csv-importer run build` outputs static files to `artifacts/csv-importer/dist/public`.
- `pnpm --filter @workspace/api-server run build` bundles the Express app to `artifacts/api-server/dist/index.mjs`.
- On boot, the backend checks whether `artifacts/csv-importer/dist/public` exists (it does, since it was built first) and if so, serves it as static assets plus a SPA fallback for any non-`/api` route. On Replit, that directory doesn't exist during normal dev (frontend runs as its own artifact behind the path-based proxy), so this code path is simply inactive there — same codebase, no dev/prod branching needed.

### Verify

After deploying:
```bash
curl https://your-app.onrender.com/api/healthz
```
Then open the same URL in a browser and run the full Upload → Preview → AI Mapping → Results flow end to end.
