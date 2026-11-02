import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  EMBEDDING_DIM,
  embeddingCacheFile,
  embeddingEntryKey,
  isValidVector,
  sanitizeCache,
} from "../evals/retrieval/embedder";

const baseCfg = {
  model: "Xenova/all-MiniLM-L6-v2",
  dtype: "q8",
  pooling: "mean" as const,
  normalize: true,
  transformersVersion: "3.0.0",
  cacheVersion: 2,
};
const vec = (n: number, fill = 0.1) => Array.from({ length: n }, () => fill);

describe("embeddingCacheFile", () => {
  it("is stable for identical config", () => {
    assert.equal(embeddingCacheFile("d", baseCfg), embeddingCacheFile("d", { ...baseCfg }));
  });
  it("changes when any single setting changes", () => {
    const base = embeddingCacheFile("d", baseCfg);
    const variants = [
      { ...baseCfg, model: "other/model" },
      { ...baseCfg, dtype: "fp32" },
      { ...baseCfg, normalize: false },
      { ...baseCfg, transformersVersion: "3.0.1" },
      { ...baseCfg, cacheVersion: 3 },
      { ...baseCfg, pooling: "cls" as unknown as "mean" },
    ];
    const files = new Set(variants.map((v) => embeddingCacheFile("d", v)));
    assert.equal(files.size, variants.length);
    for (const f of files) assert.notEqual(f, base);
  });
});

describe("embeddingEntryKey", () => {
  it("is a sha256 hex digest", () => {
    const k = embeddingEntryKey("a: b");
    assert.match(k, /^[0-9a-f]{64}$/);
    assert.equal(k, createHash("sha256").update("a: b").digest("hex"));
    assert.notEqual(k, embeddingEntryKey("a: c"));
  });
});

describe("isValidVector", () => {
  it("accepts finite vectors of the right length only", () => {
    assert.equal(EMBEDDING_DIM, 384);
    assert.equal(isValidVector(vec(384), 384), true);
    assert.equal(isValidVector(vec(383), 384), false);
    assert.equal(isValidVector("nope", 384), false);
    assert.equal(isValidVector(null, 384), false);
    assert.equal(isValidVector([...vec(383), NaN], 384), false);
    assert.equal(isValidVector([...vec(383), "x"], 384), false);
  });
});

describe("sanitizeCache", () => {
  it("keeps only valid entries", () => {
    const out = sanitizeCache({ good: vec(384), bad: vec(10) }, 384);
    assert.deepEqual(Object.keys(out), ["good"]);
  });
  it("returns {} for non-object input", () => {
    assert.deepEqual(sanitizeCache(null, 384), {});
    assert.deepEqual(sanitizeCache([vec(384)], 384), {});
    assert.deepEqual(sanitizeCache("x", 384), {});
  });
});
