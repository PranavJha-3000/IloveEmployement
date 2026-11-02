// Structured per-run traces. A trace is a flat list of timed spans whose
// attributes are counts, ids and names only; user content never goes in, so a
// trace is safe to print, return to the browser and export.

export type TraceAttr = string | number | boolean;

export interface TraceSpan {
  name: string;
  /** Milliseconds from the start of the run. */
  startMs: number;
  durationMs: number;
  attrs: Record<string, TraceAttr>;
}

export interface RunTrace {
  traceId: string;
  preset: string;
  totalMs: number;
  spans: TraceSpan[];
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class Tracer {
  readonly traceId = randomHex(16);
  readonly startedAt = Date.now();
  private readonly t0 = now();
  private readonly spans: TraceSpan[] = [];

  constructor(readonly preset: string) {}

  /** Times `fn` as one span. `attrs` may be a function of the result, so token counts can be recorded. */
  async span<T>(name: string, fn: () => Promise<T> | T, attrs?: Record<string, TraceAttr> | ((r: T) => Record<string, TraceAttr>)): Promise<T> {
    const start = now();
    let ok = true;
    let result: T | undefined;
    try {
      result = await fn();
      return result;
    } catch (err) {
      ok = false;
      throw err;
    } finally {
      const a = typeof attrs === "function" ? (ok ? attrs(result as T) : {}) : (attrs ?? {});
      this.spans.push({ name, startMs: round(start - this.t0), durationMs: round(now() - start), attrs: { ...a, ok } });
    }
  }

  finish(): RunTrace {
    return { traceId: this.traceId, preset: this.preset, totalMs: round(now() - this.t0), spans: [...this.spans] };
  }
}

const round = (n: number) => Math.round(n * 10) / 10;

// ─── Export ──────────────────────────────────────────────────────────────────

/** OTLP/HTTP JSON body for one trace (https://opentelemetry.io/docs/specs/otlp/). */
export function toOtlp(trace: RunTrace, startedAt: number): unknown {
  const ns = (ms: number) => String(Math.round((startedAt + ms) * 1e6));
  const value = (v: TraceAttr) =>
    typeof v === "number" ? (Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v }) : typeof v === "boolean" ? { boolValue: v } : { stringValue: v };
  const rootId = trace.traceId.slice(0, 16);
  const span = (name: string, startMs: number, durationMs: number, attrs: Record<string, TraceAttr>, id: string, parent?: string) => ({
    traceId: trace.traceId,
    spanId: id,
    ...(parent ? { parentSpanId: parent } : {}),
    name,
    kind: 1,
    startTimeUnixNano: ns(startMs),
    endTimeUnixNano: ns(startMs + durationMs),
    attributes: Object.entries(attrs).map(([key, v]) => ({ key, value: value(v) })),
  });
  return {
    resourceSpans: [
      {
        resource: { attributes: [{ key: "service.name", value: { stringValue: "iloveemployement" } }] },
        scopeSpans: [
          {
            scope: { name: "iloveemployement.engine" },
            spans: [
              span(`run ${trace.preset}`, 0, trace.totalMs, { preset: trace.preset }, rootId),
              ...trace.spans.map((s, i) => span(s.name, s.startMs, s.durationMs, s.attrs, (i + 1).toString(16).padStart(16, "0"), rootId)),
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Sends a finished trace to OTLP/HTTP (OTEL_EXPORTER_OTLP_ENDPOINT, optional
 * OTEL_EXPORTER_OTLP_HEADERS as "k=v,k2=v2") and prints it in development.
 * Never throws and never blocks the response on a slow backend.
 */
export async function exportTrace(trace: RunTrace, startedAt: number, env: Record<string, string | undefined> = process.env): Promise<void> {
  if (env.NODE_ENV === "development" || env.TRACE_CONSOLE === "1") {
    console.info(`[trace] ${trace.preset} ${trace.totalMs}ms ` + trace.spans.map((s) => `${s.name}=${s.durationMs}ms`).join(" "));
  }
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) return;
  const headers: Record<string, string> = { "content-type": "application/json" };
  for (const pair of (env.OTEL_EXPORTER_OTLP_HEADERS ?? "").split(",")) {
    const i = pair.indexOf("=");
    if (i > 0) headers[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  }
  try {
    await fetch(`${endpoint.replace(/\/+$/, "")}/v1/traces`, {
      method: "POST",
      headers,
      body: JSON.stringify(toOtlp(trace, startedAt)),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Observability must never break a run.
  }
}
