// Resume version diff (stub for the RED commit; implemented in the GREEN commit).
export type DiffOp<T> = { op: "equal" | "insert" | "delete"; items: T[] };
export type WordSegment = { text: string; changed: boolean };

export function diffSequences<T>(_a: T[], _b: T[], _eq?: (x: T, y: T) => boolean): DiffOp<T>[] {
  throw new Error("not implemented");
}

export function diffWords(_from: string, _to: string): { from: WordSegment[]; to: WordSegment[] } {
  throw new Error("not implemented");
}

export function normalizeResumeLines(_text: string): string[] {
  throw new Error("not implemented");
}
