---
name: Orval-generated API client uses relative URLs
description: Generated React Query hooks (Orval + custom-fetch) call relative /api/... paths by default; cross-origin backend deploys need explicit base URL wiring.
---

The Orval-generated client (`@workspace/api-client-react`, built on a custom fetch wrapper) builds request URLs as relative paths like `/api/csv/process` (see each `get<Operation>Url()` function in `generated/api.ts`). This works transparently on Replit because artifacts share an origin via the path-based proxy — the frontend and backend both live under the same domain.

**Why:** the moment frontend and backend are deployed as separate services with different origins (e.g. two Render services), relative `/api/...` calls resolve against the frontend's own origin and 404, since there's no backend there.

**How to apply:** call `setBaseUrl(url)` (exported from `@workspace/api-client-react`, wraps the custom fetch) once at app startup — e.g. in `main.tsx`, gated on a frontend build-time env var like `VITE_API_URL`. Leave it unset/null for same-origin deployments (Replit) so relative paths keep working. Any project with this Orval/custom-fetch pattern that later splits frontend/backend into separate deploy targets will need the same wiring.
