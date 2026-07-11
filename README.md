# 🚀 GrowEasy AI CSV Importer

**Turn any messy CSV into clean CRM records — automatically.**

Upload a spreadsheet, preview it, let AI figure out which column is which, review the guesses, and export ready-to-use CRM records. No manual field-mapping spreadsheets, no copy-pasting.

```
📄 Any CSV  →  👀 Preview  →  🤖 AI Mapping  →  ✅ Clean CRM Records
```

---

## ✨ What it does

| | |
|---|---|
| 🗂️ **Upload anything** | Drag-and-drop a CSV up to 10 MB / 50,000 rows — headers can be named however your export tool named them. |
| 🔍 **Preview before AI touches it** | See exactly what will be imported (delimiter, row/column counts, full data table) before any AI call happens. |
| 🤖 **AI-suggested mapping** | Groq (Llama 3.3 70B, with automatic fallback to Qwen3 32B) reads your headers + a few sample rows and proposes a confidence-scored mapping to 15 standard CRM fields. |
| ✏️ **You stay in control** | Every AI suggestion can be overridden with a dropdown before anything is imported. |
| 📊 **Results you can trust** | A final table shows what was imported, skipped, or failed — filterable, searchable, and exportable back to CSV. |
| 🌗 **Dark mode & toasts** | Polished UX details: persisted dark mode, toast feedback on every action, and automatic retry with model fallback if the AI call hiccups. |

---

## 🧭 The 4-step wizard

```
 ① Upload  ──▶  ② Preview  ──▶  ③ AI Mapping  ──▶  ④ Results
```

| Step | Route | What happens |
|:---:|---|---|
| **1** | `/` | Drag-and-drop or click to pick a CSV. Validated for type and size, then parsed in the browser. |
| **2** | `/preview` | Scrollable table of every row, with row/column counts and detected delimiter. Nothing is sent anywhere yet. |
| **3** | `/mapping` | AI analyzes your headers + a few sample rows and proposes a mapping with confidence scores. Override anything, then kick off the import. |
| **4** | `/results` | See imported / skipped / failed counts, filter and search the results, and export the cleaned data as CSV. |

---

## 🔄 How data flows under the hood

```
User uploads CSV
      │
      ▼
Browser parses CSV (PapaParse) — nothing leaves the browser yet
      │
      ▼
POST /api/csv/map-columns   (headers + 5 sample rows)
      │
      ▼
Groq AI suggests column → CRM field mappings, with confidence scores
      │
      ▼
User reviews and (optionally) corrects the mapping
      │
      ▼
POST /api/csv/process   (headers + all rows + final mapping)
      │
      ▼
Groq AI extracts + normalizes every row, in batches, with retries
      │
      ▼
Results table → filter, search, export to CSV
```

---

## 🏗️ Project structure

```
monorepo (pnpm workspaces)
├── artifacts/
│   ├── api-server/     → Express + TypeScript backend  (the API)
│   └── csv-importer/   → React + Vite frontend          (the UI)
└── lib/
    ├── api-spec/            → OpenAPI 3.1 contract (single source of truth)
    ├── api-client-react/    → Auto-generated React Query hooks
    └── api-zod/             → Auto-generated Zod validators
```

<details>
<summary><strong>Frontend file reference</strong> (<code>artifacts/csv-importer/src/</code>)</summary>

| File / Folder | Purpose |
|---|---|
| `main.tsx` | React entry point; wires `VITE_API_URL` for split-service deployments. |
| `App.tsx` | Providers (React Query, import wizard state) + routing for the 4 wizard steps. |
| `index.css` | Tailwind v4 theme — green palette, dark mode variables. |
| `types/index.ts` | Shared TypeScript types: `CrmRecord`, `ColumnMapping`, `ParsedCsvData`, etc. |
| `context/ImportContext.tsx` | Holds the entire wizard state (file, parsed data, mappings, results) across all 4 pages. |
| `hooks/useDarkMode.ts` | Dark mode toggle, persisted to `localStorage`. |
| `utils/csvUtils.ts` | CSV parsing, sample CSV generation, file size formatting. |
| `components/StepIndicator.tsx` | The 4-step progress bar shown on every page. |
| `pages/UploadPage.tsx` | Step 1 — drag-and-drop, validation, sample CSV download. |
| `pages/PreviewPage.tsx` | Step 2 — data table + confirm. |
| `pages/MappingPage.tsx` | Step 3 — AI mapping review + overrides. |
| `pages/ResultsPage.tsx` | Step 4 — results, filters, export. |

</details>

<details>
<summary><strong>Backend file reference</strong> (<code>artifacts/api-server/src/</code>)</summary>

| File / Folder | Purpose |
|---|---|
| `index.ts` | Starts the Express server on `$PORT`. |
| `app.ts` | CORS, JSON body parsing, request logging, mounts the `/api` router. |
| `routes/health.ts` | `GET /api/healthz` — liveness probe. |
| `routes/csv.ts` | `POST /api/csv/map-columns` and `POST /api/csv/process`. |
| `lib/groq.ts` | Groq AI client — column mapping + batch row extraction, with automatic retry and model fallback. |
| `lib/logger.ts` | Structured logging (pretty in dev, JSON in production). |

</details>

<details>
<summary><strong>API contract</strong> (<code>lib/api-spec/openapi.yaml</code>)</summary>

Single source of truth for the API — run `pnpm --filter @workspace/api-spec run codegen` after editing it.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `POST` | `/api/csv/map-columns` | AI column mapping → `ColumnMapping[]` |
| `POST` | `/api/csv/process` | Batch AI extraction → `ProcessedRecord[]` |

**CRM fields (15 total):** `created_at`, `name`, `email`, `country_code`, `mobile_without_country_code`, `company`, `city`, `state`, `country`, `lead_owner`, `crm_status`, `crm_note`, `data_source`, `possession_time`, `description`

</details>

---

## 🛠️ Tech stack

| Layer | Tech |
|---|---|
| **Frontend** | React 19 · Vite · TypeScript · Tailwind CSS v4 · wouter · TanStack Query |
| **CSV parsing** | PapaParse (runs client-side, in the browser) |
| **AI** | Groq — `llama-3.3-70b-versatile` primary, `qwen/qwen3-32b` fallback, plain `fetch` (no SDK) |
| **Backend** | Express 5 · TypeScript · pino |
| **API contract** | OpenAPI 3.1 → Orval codegen |
| **Package manager** | pnpm workspaces |

---

## 🧯 Reliability, by design

- **Automatic retry** — a failed Groq call is retried up to 3 times with exponential backoff, but only for transient errors (rate limits, timeouts, 5xx). A bad API key fails fast instead of retrying pointlessly.
- **Model fallback** — if the primary model fails outright, the request automatically retries against the fallback model before giving up.
- **Manual retry** — if both automated layers fail, the Mapping and Results pages surface a "Retry" button so the user can try again once the issue is resolved.
- **Toast feedback** — every meaningful action (file accepted, mapping ready, import finished, export downloaded) surfaces a toast, so nothing happens silently.

---

## 🧹 Data cleaning rules

The importer doesn't just pass CSV rows straight to the AI — a few deterministic rules run first, so results are consistent and nothing gets silently dropped:

- **Skip rule** — a row is only importable if it has an email **or** a mobile number. A name alone isn't enough to identify a lead, so name-only rows are excluded.
- **Multiple emails / phone numbers** — if a cell contains more than one email (e.g. `"a@x.com, b@y.com"`) or more than one phone number (e.g. `"98765..., 91234..."`), the first is kept as the record's canonical value and the rest are appended into `crm_note` (e.g. `Additional email(s): b@y.com`) instead of being discarded.
- **Fixed enums** — `crm_status` and `data_source` are guarded against AI hallucination: if the model returns a value outside the fixed set, the field falls back to `null` rather than accepting an invalid value.

---

## 💻 Local development

```bash
# Install everything
pnpm install

# Start the frontend
pnpm --filter @workspace/csv-importer run dev

# Start the backend
pnpm --filter @workspace/api-server run dev

# Regenerate API types/hooks after editing openapi.yaml
pnpm --filter @workspace/api-spec run codegen
```

You'll need a `GROQ_API_KEY` set in your environment for the AI endpoints to work.

---

## ☁️ Deploying to Render

This app deploys as **one Render service**. The Express backend serves both the JSON API (`/api/*`) and the built React frontend (everything else, with SPA fallback) from a single Node process. Render doesn't understand the pnpm workspace layout by default, so the build command below builds the frontend first, then the backend.

### Render "Web Service" settings

| Setting | Value |
|---|---|
| Root Directory | repository root (leave blank) |
| Runtime | Node |
| Build Command | `pnpm install --frozen-lockfile && PORT=10000 BASE_PATH=/ pnpm --filter @workspace/csv-importer run build && pnpm --filter @workspace/api-server run build` |
| Start Command | `pnpm --filter @workspace/api-server run start` |
| Health Check Path | `/api/healthz` |

> `PORT=10000 BASE_PATH=/` in the build command are dummy build-time values only — Vite requires them to be set, but a static build doesn't actually bind a port. The real runtime port comes from Render's own `PORT` env var at start time.

**Environment variables to set on Render:**

| Variable | Notes |
|---|---|
| `GROQ_API_KEY` | Your Groq API key. Required — without it, the AI endpoints return a clean 500 instead of crashing. |
| `PORT` | Set automatically by Render at runtime. |
| `NODE_ENV` | `production` |

You do **not** need `VITE_API_URL` for this single-service setup — frontend and backend share one origin, so relative `/api/...` calls just work. (It only exists as an escape hatch in `main.tsx` if you ever split the two into separate services.)

<details>
<summary>How the single-service build works</summary>

- `pnpm --filter @workspace/csv-importer run build` outputs static files to `artifacts/csv-importer/dist/public`.
- `pnpm --filter @workspace/api-server run build` bundles the Express app to `artifacts/api-server/dist/index.mjs`.
- On boot, the backend checks whether `artifacts/csv-importer/dist/public` exists (it does, since it was built first) and serves it as static assets with an SPA fallback for any non-`/api` route. On Replit, that directory doesn't exist during normal dev (the frontend runs as its own artifact behind the preview proxy), so this code path is simply inactive there — same codebase, no dev/prod branching needed.

</details>

### Verify it worked

```bash
curl https://your-app.onrender.com/api/healthz
```

Then open the URL in a browser and run through Upload → Preview → AI Mapping → Results end to end.
