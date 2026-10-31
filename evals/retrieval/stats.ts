// Seeded statistics for the retrieval decision rule. Pure: no clock, no Math.random.

/** Standard 32-bit mulberry32 PRNG; returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Percentile bootstrap CI of the mean of paired deltas.
 * lo = sorted[floor((alpha/2) * B)], hi = sorted[ceil((1 - alpha/2) * B) - 1].
 */
export function pairedBootstrapCI(
  deltas: number[],
  opts: { iterations?: number; seed?: number; confidence?: number } = {},
): { mean: number; lo: number; hi: number } {
  const { iterations = 10000, seed = 20261031, confidence = 0.95 } = opts;
  const n = deltas.length;
  if (n === 0) throw new Error("pairedBootstrapCI: empty input");
  for (const d of deltas) {
    if (!Number.isFinite(d)) throw new Error("pairedBootstrapCI: non-finite delta");
  }
  const mean = deltas.reduce((s, x) => s + x, 0) / n;
  const rand = mulberry32(seed);
  const means = new Float64Array(iterations);
  for (let b = 0; b < iterations; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += deltas[Math.floor(rand() * n)];
    means[b] = sum / n;
  }
  means.sort();
  const alpha = 1 - confidence;
  const lo = means[Math.floor((alpha / 2) * iterations)];
  const hi = means[Math.ceil((1 - alpha / 2) * iterations) - 1];
  return { mean, lo, hi };
}
