// Stub (RED phase). Implemented in the GREEN commit.
export function mulberry32(_seed: number): () => number {
  throw new Error("not implemented");
}

export function pairedBootstrapCI(
  _deltas: number[],
  _opts?: { iterations?: number; seed?: number; confidence?: number },
): { mean: number; lo: number; hi: number } {
  throw new Error("not implemented");
}
