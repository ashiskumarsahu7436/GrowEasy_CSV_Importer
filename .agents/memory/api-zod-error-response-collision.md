---
name: Zod/TS codegen name collision on shared schema names
description: An OpenAPI schema (e.g. ErrorResponse) that generates both a TS interface and a Zod const under the same name breaks value-position imports (TS2693).
---

When an OpenAPI schema name (e.g. `ErrorResponse`) is emitted by codegen as both a TypeScript `interface`/`type` (type space) and a Zod `const` (value space) via wildcard barrel exports, importing it normally resolves to the type-only binding. Using it as a value (e.g. calling `.parse()`) throws `TS2693: 'X' only refers to a type, but is being used as a value here`.

**Why:** the barrel re-export can't disambiguate which of the two same-named bindings to prefer, and TypeScript's module resolution picks the type.

**How to apply:** import it explicitly `import type { ErrorResponse } from "..."` for typing purposes, and construct plain literal objects matching its shape (e.g. `{ error: string }`) instead of calling `.parse()` on the value. This pattern applies to any schema name shared between the generated Zod validators package and its type exports.
