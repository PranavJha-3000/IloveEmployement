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

/**
 * Unified resume diff. Delete runs are paired index by index with the insert
 * run that follows them ("changed" rows, with word emphasis); leftovers become
 * removed or added rows. Unchanged runs longer than `collapseOver` (default 6)
 * keep `context` (default 3) lines beside each change and collapse the rest.
 */
export function buildResumeDiff(fromText: string, toText: string, opts: { context?: number; collapseOver?: number } = {}): ResumeDiff {
  const context = Math.max(0, opts.context ?? 3);
  const collapseOver = Math.max(0, opts.collapseOver ?? 6);
  const a = normalizeResumeLines(fromText);
  const b = normalizeResumeLines(toText);
  const counts = { added: 0, removed: 0, changed: 0 };

  if (a.length === b.length && a.every((line, i) => line === b[i])) {
    return { rows: a.map((text) => ({ type: "context" as const, text })), counts, identical: true, changeCount: 0 };
  }

  // 1. Expand ops into rows. A change group is one contiguous non-equal block.
  const ops = diffSequences(a, b);
  const rows: DiffRow[] = [];
  let group = -1;
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o.op === "equal") {
      for (const text of o.items) rows.push({ type: "context", text });
      continue;
    }
    group += 1;
    // diffSequences emits delete before insert, so a replacement is delete + insert side by side.
    const dels = o.op === "delete" ? o.items : [];
    const next = ops[i + 1];
    const ins = o.op === "insert" ? o.items : next && next.op === "insert" ? next.items : [];
    if (o.op === "delete" && next && next.op === "insert") i += 1;
    const pairs = Math.min(dels.length, ins.length);
    for (let p = 0; p < pairs; p++) {
      const w = diffWords(dels[p], ins[p]);
      rows.push({ type: "changed", from: w.from, to: w.to, changeIndex: group });
      counts.changed += 1;
    }
    for (let p = pairs; p < dels.length; p++) {
      rows.push({ type: "removed", text: dels[p], changeIndex: group });
      counts.removed += 1;
    }
    for (let p = pairs; p < ins.length; p++) {
      rows.push({ type: "added", text: ins[p], changeIndex: group });
      counts.added += 1;
    }
  }

  // 2. Collapse long unchanged runs.
  const out: DiffRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row.type !== "context") {
      out.push(row);
      i += 1;
      continue;
    }
    let j = i;
    while (j < rows.length && rows[j].type === "context") j += 1;
    const run = rows.slice(i, j) as Extract<DiffRow, { type: "context" }>[];
    const before = i > 0; // a change precedes this run
    const after = j < rows.length; // a change follows this run
    if (run.length <= collapseOver || context * ((before ? 1 : 0) + (after ? 1 : 0)) >= run.length) {
      out.push(...run);
    } else {
      const head = before ? context : 0;
      const tail = after ? context : 0;
      const hidden = run.slice(head, run.length - tail);
      out.push(...run.slice(0, head));
      out.push({ type: "collapsed", count: hidden.length, lines: hidden.map((r) => r.text) });
      out.push(...run.slice(run.length - tail));
    }
    i = j;
  }

  return { rows: out, counts, identical: false, changeCount: group + 1 };
}
