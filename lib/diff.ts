// Resume version diff. Dependency-free: an O((N+M)D) Myers diff over lines,
// a word-level diff inside changed line pairs, and the view model the versions
// UI renders. Pure and synchronous; no DOM, no imports.

export type DiffOp<T> = { op: "equal" | "insert" | "delete"; items: T[] };
export type WordSegment = { text: string; changed: boolean };

// ─── Myers diff ──────────────────────────────────────────────────────────────

/** Line-level diff with the shortest edit script. Inside a replacement, deletes come before inserts. */
export function diffSequences<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = (x, y) => x === y): DiffOp<T>[] {
  const n = a.length;
  const m = b.length;
  if (!n && !m) return [];
  if (!n) return [{ op: "insert", items: b.slice() }];
  if (!m) return [{ op: "delete", items: a.slice() }];

  const max = n + m;
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  // trace[d] is v as it stood entering round d, for k in [-d-1, d+1].
  const trace: Int32Array[] = [];
  let found = -1;
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]);
      let x = down ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && eq(a[x], b[y])) {
        x++;
        y++;
      }
      v[off + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break outer;
      }
    }
  }

  // Backtrack into single-item edits (collected in reverse).
  const edits: { op: DiffOp<T>["op"]; item: T }[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const snap = trace[d];
    const at = (k: number) => snap[k + d + 1];
    const k = x - y;
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const prevK = down ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      edits.push({ op: "equal", item: a[x - 1] });
      x--;
      y--;
    }
    if (down) edits.push({ op: "insert", item: b[prevY] });
    else edits.push({ op: "delete", item: a[prevX] });
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    edits.push({ op: "equal", item: a[x - 1] });
    x--;
    y--;
  }
  edits.reverse();

  // Group into runs; within each non-equal region put every delete before every insert.
  const out: DiffOp<T>[] = [];
  const push = (op: DiffOp<T>["op"], items: T[]) => {
    if (items.length) out.push({ op, items });
  };
  let i = 0;
  while (i < edits.length) {
    if (edits[i].op === "equal") {
      const items: T[] = [];
      while (i < edits.length && edits[i].op === "equal") items.push(edits[i++].item);
      push("equal", items);
    } else {
      const dels: T[] = [];
      const ins: T[] = [];
      while (i < edits.length && edits[i].op !== "equal") {
        if (edits[i].op === "delete") dels.push(edits[i].item);
        else ins.push(edits[i].item);
        i++;
      }
      push("delete", dels);
      push("insert", ins);
    }
  }
  return out;
}

// ─── Word diff ───────────────────────────────────────────────────────────────

function mergeSegments(segs: WordSegment[]): WordSegment[] {
  const out: WordSegment[] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && last.changed === s.changed) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/** Word-level diff of two lines. Whitespace tokens are kept so both sides re-join to the original text. */
export function diffWords(from: string, to: string): { from: WordSegment[]; to: WordSegment[] } {
  const tok = (s: string) => s.split(/(\s+)/).filter((t) => t !== "");
  const ops = diffSequences(tok(from), tok(to));
  const f: WordSegment[] = [];
  const t: WordSegment[] = [];
  for (const o of ops) {
    for (const item of o.items) {
      if (o.op === "equal") {
        f.push({ text: item, changed: false });
        t.push({ text: item, changed: false });
      } else if (o.op === "delete") f.push({ text: item, changed: true });
      else t.push({ text: item, changed: true });
    }
  }
  return { from: mergeSegments(f), to: mergeSegments(t) };
}

// ─── Line normalisation ──────────────────────────────────────────────────────

const BULLET = /^[•●▪◦‣∙·\-–—*]\s+/;

/** Lines with formatting noise removed, so bullet glyphs, trailing spaces, CRLF and blank-line runs never show as changes. */
export function normalizeResumeLines(text: string): string[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((raw) => {
      const line = raw.replace(/\s+/g, " ").trim();
      return line.replace(BULLET, "• ");
    });
  const out: string[] = [];
  for (const line of lines) {
    if (line === "" && (out.length === 0 || out[out.length - 1] === "")) continue;
    out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

// ─── Resume diff view model ──────────────────────────────────────────────────

export type DiffRow =
  | { type: "context"; text: string }
  | { type: "added"; text: string; changeIndex: number }
  | { type: "removed"; text: string; changeIndex: number }
  | { type: "changed"; from: WordSegment[]; to: WordSegment[]; changeIndex: number }
  | { type: "collapsed"; count: number; lines: string[] };

export interface ResumeDiff {
  rows: DiffRow[];
  counts: { added: number; removed: number; changed: number };
  identical: boolean;
  changeCount: number;
}

export function buildResumeDiff(_fromText: string, _toText: string, _opts?: { context?: number; collapseOver?: number }): ResumeDiff {
  throw new Error("not implemented");
}
