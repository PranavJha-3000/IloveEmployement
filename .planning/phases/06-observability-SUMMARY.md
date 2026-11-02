# Phase 6: Observability (2026-11-02)

- **OBS-01:** `lib/engine/trace.ts` `Tracer`; `runPreset` records spans for the injection gate, GitHub source, knowledge retrieval, context assembly, draft/review/revise model calls (model and token counts), finalizer and grounding. The trace is returned as `meta.trace`, so the agent workflow (which runs presets) carries it too.
- **OBS-02:** In development (or `TRACE_CONSOLE=1`) a one-line trace is printed. With `OTEL_EXPORTER_OTLP_ENDPOINT` (and optional `OTEL_EXPORTER_OTLP_HEADERS`, which works for Langfuse's OTLP endpoint) traces are POSTed as OTLP/HTTP JSON, in the background, with a 2 s timeout, never failing the run. Span attributes are counts, ids and names only; a test asserts user text never appears in a trace.
- **OBS-03:** "How this was generated" (`components/engine/RunDetails.tsx`) shows a per-step timing waterfall with token counts.
- Tests: `tests/trace.test.ts`.
