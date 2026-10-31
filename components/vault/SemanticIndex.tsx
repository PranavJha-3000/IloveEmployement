"use client";

import { useEffect, useState } from "react";
import type { VaultChunk } from "@/lib/engine/types";
import { buildIndex, EMBEDDING_MODEL, indexStatus, loadEmbedder } from "@/lib/vault/embeddings";

/**
 * Opt-in semantic index. Building it downloads a small embedding model once
 * (cached by the browser) and embeds every vault chunk on this device. Tools
 * then retrieve with hybrid search: BM25 + embeddings, fused with RRF.
 */
export function SemanticIndex({ chunks }: { chunks: VaultChunk[] }) {
  const [status, setStatus] = useState<{ indexed: number; total: number } | null>(null);
  const [phase, setPhase] = useState<"idle" | "downloading" | "embedding">("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    indexStatus(chunks).then((s) => live && setStatus({ indexed: s.indexed, total: s.total }));
    return () => {
      live = false;
    };
  }, [chunks]);

  async function build() {
    setError("");
    try {
      setPhase("downloading");
      await loadEmbedder((pct) => setProgress(`Downloading model… ${pct}%`));
      setPhase("embedding");
      const started = performance.now();
      await buildIndex(chunks, (done, total) => setProgress(`Embedding ${done}/${total} chunks…`));
      const s = await indexStatus(chunks);
      setStatus({ indexed: s.indexed, total: s.total });
      setProgress(`Indexed in ${((performance.now() - started) / 1000).toFixed(1)}s, on this device.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't build the index.");
    } finally {
      setPhase("idle");
    }
  }

  if (!chunks.length) return null;
  const complete = status && status.total > 0 && status.indexed === status.total;
  const stale = status && status.indexed > 0 && !complete;

  return (
    <section className="rounded-xl border border-zinc-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 className="text-[15px] font-bold text-zinc-900">Semantic search {complete && <span className="text-[12px] font-semibold text-emerald-600">· on</span>}</h2>
          <p className="mt-1 text-[13px] text-zinc-500">
            Lets tools find relevant experience even when the wording differs ("shipped faster" ↔ "reduced lead time"). Runs entirely in your browser
            with a small open model ({EMBEDDING_MODEL.split("/")[1]}, ~23 MB, downloaded once). Retrieval then fuses keyword and semantic rankings.
          </p>
          {status && (
            <p className="mt-2 text-[12.5px] font-medium text-zinc-700">
              {status.indexed}/{status.total} chunks indexed
              {stale && " · some chunks changed since the last index"}
            </p>
          )}
          {progress && <p className="mt-1 text-[12px] text-zinc-500">{progress}</p>}
          {error && <p className="form-error">{error}</p>}
        </div>
        {!complete && (
          <button type="button" className="cta-secondary" disabled={phase !== "idle"} onClick={() => void build()}>
            {phase !== "idle" ? "Working…" : stale ? "Update index" : "Build semantic index"}
          </button>
        )}
      </div>
    </section>
  );
}
