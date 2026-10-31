"use client";

import { useEffect, useState } from "react";
import type { VaultChunk } from "../engine/types";
import { semanticRanking } from "../retrieval/fusion";
import { embeddingQuery } from "../retrieval/embedText";
import type { StoredVector } from "./store";
import { embedTexts, indexStatus } from "./embeddings";

/**
 * Semantic ranking of vault chunks for a query, when the user has built a
 * semantic index on the vault page. Returns null (keyword-only retrieval)
 * until the index covers the vault and the query embedding is ready.
 */
export function useSemanticOrder(chunks: VaultChunk[], query: string, enabled: boolean): string[] | null {
  const [vectors, setVectors] = useState<StoredVector[] | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);

  useEffect(() => {
    let live = true;
    setVectors(null);
    if (!enabled || !chunks.length) return;
    indexStatus(chunks).then((s) => {
      // Only go hybrid when the whole vault is indexed; a partial index would bias results.
      if (live && s.total > 0 && s.indexed === s.total) setVectors(s.vectors);
    });
    return () => {
      live = false;
    };
  }, [chunks, enabled]);

  useEffect(() => {
    if (!vectors || !query.trim()) {
      setOrder(null);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      embedTexts([embeddingQuery(query)])
        .then(([q]) => live && setOrder(semanticRanking(q, vectors)))
        .catch(() => live && setOrder(null));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [vectors, query]);

  return order;
}
