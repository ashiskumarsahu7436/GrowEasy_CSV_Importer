---
name: Gemini call reliability pattern
description: Retry transient errors with backoff, fail fast on permanent errors, and always guarantee one output per input record when parsing structured JSON from an LLM.
---

For backend code calling Gemini (or similar LLMs) for structured JSON extraction/transformation over a batch of items, the reliable pattern is:

1. **Retry only transient errors** (rate limits/429, 5xx, timeouts, connection resets) with exponential backoff (e.g. 3 attempts, base delay doubling). Fail immediately on non-transient errors (malformed JSON response, invalid API key) — retrying those just wastes time and money for the same failure.
2. **Guarantee output cardinality** — if the model's JSON array response has the wrong length or omits/mangles an entry, fall back to the original input item for that index rather than dropping it or throwing. Never let a partial/malformed AI response reduce the number of records processed.
3. **Guard enum-like fields** against hallucinated values outside the fixed set — if the model returns a status value not in the known enum, revert to the original raw value instead of accepting the hallucination.

**Why:** LLM calls fail transiently often enough that a bare `await model.generateContent()` in an import/data pipeline causes visible, avoidable failures; but retrying deterministic parsing failures just delays an inevitable error.

**How to apply:** wrap the raw model call in a small `withRetry(label, fn)` helper keyed on error-message pattern matching (`/429|5\d\d|timeout|ECONNRESET/i`), and always `.map()` the parsed response back onto the original input array by index with a fallback, never assume 1:1 correspondence is guaranteed.
