# GrowEasy AI CSV Importer

A full-stack AI-powered CSV importer: upload a CSV, preview it, get AI-suggested CRM field mappings via Google Gemini, review/override those mappings, and (eventually) export normalized CRM records.

pnpm monorepo — see `README.md` for full architecture, file reference, and data flow.

## Environment

- **Development**: runs on Replit via the `artifacts/csv-importer` (frontend, Vite) and `artifacts/api-server` (backend, Express) workflows.
- **Deployment target**: Render (not Replit deployments). The user configures Render's env vars separately at deploy time.

## Running locally (on Replit)

Both workflows are already configured and start automatically:
- `artifacts/csv-importer: web` — React/Vite frontend
- `artifacts/api-server: API Server` — Express backend (builds then starts)

To run manually:
```bash
pnpm install
pnpm --filter @workspace/csv-importer run dev   # frontend
pnpm --filter @workspace/api-server run dev     # backend
```

## Secrets / env vars

- `GEMINI_API_KEY` — required by the backend (`artifacts/api-server/src/lib/gemini.ts`) to call Google Gemini for AI column mapping (`POST /api/csv/map-columns`) and row normalization (`POST /api/csv/process`). Read via `process.env.GEMINI_API_KEY`, never hardcoded.
  - **User preference:** the user will add this themselves later, at Render deploy time, via Render's env var settings — not requested as a Replit secret ahead of time. Until it's set, both AI endpoints return a clear 500 error instead of crashing.
- `VITE_API_URL` — frontend-only, build-time escape hatch (`src/main.tsx` → `setBaseUrl()`), only relevant if the frontend and backend are ever split into separate services again. **Not needed** for the current single-service Render deploy or on Replit — both serve the frontend and API from one origin, so relative `/api/...` calls just work.

## UX features

- Dark mode (persisted, all 4 pages), toast notifications (sonner) for key actions, and automatic retry-with-backoff for transient Gemini failures (plus manual Retry buttons on AI failures) — see README "UX features" section for details.

## User preferences

- Do not set up Replit-specific deployment for this project — the user develops on Replit but deploys to Render separately.
- Preview/dev workflows should stay running for live iteration, but don't configure Replit Deployments.
- Never hardcode secret values in code; always read from `process.env`.
- Uses the user's own Gemini API key (direct `@google/generative-ai` SDK), not Replit's AI Integrations proxy — the proxy only works inside Replit and would break on Render.

## Status

See `project_updates.md` for prompt-by-prompt build progress.
