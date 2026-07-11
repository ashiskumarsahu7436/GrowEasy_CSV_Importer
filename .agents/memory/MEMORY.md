# Memory Index

- [Zod/TS codegen name collision](api-zod-error-response-collision.md) — an OpenAPI schema that generates both a TS type and a Zod value under the same exported name breaks value-position imports.
- [Orval-generated API client base URL](orval-relative-api-base-url.md) — generated hooks call relative `/api/...` paths; cross-origin deploys (e.g. split frontend/backend on Render) need explicit `setBaseUrl()` wiring.
- [Gemini call reliability pattern](gemini-call-reliability-pattern.md) — retry transient errors with backoff, fail fast on permanent ones, and always guarantee one output per input record.
