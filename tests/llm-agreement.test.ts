import assert from "node:assert";
import { test } from "node:test";
import {
  bootstrapStat, cohenKappa, computeAgreement, rawAgreement, weightedKappa, withinOneAgreement,
  type AgreementPair, type Rating,
} from "../evals/llm/agreement";

const expand = (cells: Array<[boolean, boolean, number]>) => cells.flatMap(([a, b, n]) => Array.from({ length: n }, () => [a, b] as const));

test("cohenKappa: 2x2 example a=20 b=5 c=10 d=15 gives po 0.70, pe 0.50, kappa 0.40", () => {
  const pairs = expand([[true, true, 20], [true, false, 5], [false, true, 10], [false, false, 15]]);
  assert.ok(Math.abs((cohenKappa(pairs) as number) - 0.4) < 1e-9);
  assert.ok(Math.abs((rawAgreement(pairs) as number) - 0.7) < 1e-9);
});

test("weightedKappa: identical = 1, near-miss on crafted example = 7/8, reversed = -1", () => {
  assert.strictEqual(weightedKappa([[1, 1], [2, 2], [3, 3], [4, 4]]), 1);
  // human 1,2,3,4 vs judge 1,2,3,3. Quadratic weights w(i,j) = 1 - ((i-j)/3)^2.
  // po_w = (3 + 8/9) / 4 = 35/36. Judge marginals .25,.25,.5,0 against uniform human marginals
  // give pe_w = 7/9. kappa_w = (35/36 - 28/36) / (8/36) = 7/8 = 0.875.
  const near = weightedKappa([[1, 1], [2, 2], [3, 3], [4, 3]]) as number;
  assert.ok(Math.abs(near - 7 / 8) < 1e-9);
  // Unweighted kappa on the same data is (0.75 - 0.25) / 0.75 = 0.667: the near miss costs less when weighted.
  const plain = cohenKappa([[1, 1], [2, 2], [3, 3], [4, 3]]) as number;
  assert.ok(Math.abs(plain - 2 / 3) < 1e-9);
  assert.ok(near > plain);
  // Reversed ratings: po_w = 4/9, pe_w = 13/18, kappa_w = -1.
  const rev = weightedKappa([[1, 4], [4, 1], [2, 3], [3, 2]]) as number;
  assert.ok(Math.abs(rev + 1) < 1e-9);
});

test("kappas are null when expected agreement is 1, raw agreement still 1", () => {
  const same: Array<readonly [boolean, boolean]> = [[true, true], [true, true], [true, true]];
  assert.strictEqual(cohenKappa(same), null);
  assert.strictEqual(rawAgreement(same), 1);
  assert.strictEqual(weightedKappa([[3, 3], [3, 3]]), null);
  assert.strictEqual(cohenKappa([]), null);
  assert.strictEqual(rawAgreement([]), null);
});

test("withinOneAgreement counts |a-b| <= 1", () => {
  assert.strictEqual(withinOneAgreement([[1, 2], [4, 2], [3, 3], [1, 4]]), 0.5);
});

test("bootstrapStat: deterministic per seed, seed changes the interval, null resamples are skipped and counted", () => {
  const items = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1];
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const a = bootstrapStat(items, mean, { iterations: 500, seed: 7 });
  const b = bootstrapStat(items, mean, { iterations: 500, seed: 7 });
  const c = bootstrapStat(items, mean, { iterations: 500, seed: 8 });
  assert.deepStrictEqual(a, b);
  assert.ok(a.lo !== c.lo || a.hi !== c.hi);
  assert.ok((a.lo as number) <= (a.value as number) && (a.value as number) <= (a.hi as number));
  assert.strictEqual(a.skipped, 0);
  const sometimesNull = bootstrapStat(items, (xs) => (xs[0] === 1 ? mean(xs) : null), { iterations: 400, seed: 3 });
  assert.ok(sometimesNull.skipped > 0 && sometimesNull.skipped < 400);
  const never = bootstrapStat(items, () => null, { iterations: 10, seed: 1 });
  assert.deepStrictEqual(never, { value: null, lo: null, hi: null, skipped: 10 });
});

// Synthetic ratings only; these are test fixtures, not real labels.
const rating = (g: number, t: number, c: number, fab: boolean, cites: Rating["citations"] = {}): Rating => ({
  scores: { groundedness: g, task_fit: t, clarity: c }, fabricationPresent: fab, citations: cites,
});

function synthetic(): AgreementPair[] {
  const out: AgreementPair[] = [];
  for (let i = 0; i < 12; i++) {
    const g = (i % 4) + 1;
    out.push({
      itemId: `L${i + 1}`,
      human: rating(g, 3, 4, i % 3 === 0, { 1: "supports", 2: i % 2 ? "partial" : "supports" }),
      judge: rating(Math.min(4, g + (i % 5 === 0 ? 1 : 0)), 3, 4, i % 3 === 0 || i === 4, { 1: "supports", 2: "supports", 3: "does_not_support" }),
    });
  }
  return out;
}

test("computeAgreement: per-dimension, fabrication and pooled citation support", () => {
  const pairs = synthetic();
  const a = computeAgreement(pairs, { iterations: 300 });
  assert.strictEqual(a.items, 12);
  assert.strictEqual(a.dimensions.task_fit.exact, 1);
  assert.strictEqual(a.dimensions.task_fit.weightedKappa, null, "constant ratings have no variance");
  assert.strictEqual(a.dimensions.groundedness.n, 12);
  assert.ok((a.dimensions.groundedness.withinOne as number) >= (a.dimensions.groundedness.exact as number));
  assert.ok(a.dimensions.groundedness.ci.lo !== null);
  assert.strictEqual(a.fabrication.n, 12);
  assert.ok((a.fabrication.raw as number) < 1);
  // Units both raters labelled: indices 1 and 2 per item (the judge's index 3 has no human verdict) = 24 units.
  assert.strictEqual(a.citationSupport.nUnits, 24);
  assert.strictEqual(a.citationSupport.nItems, 12);
  // Human says supports on unit 1 for all 12 items and on unit 2 for the 6 even items = 18 of 24; the judge says supports on all 24.
  assert.ok(Math.abs((a.citationSupport.raw as number) - 18 / 24) < 1e-9);
  assert.deepStrictEqual(computeAgreement(pairs, { iterations: 300 }), a);
});

test("computeAgreement defaults: 10000 resamples and seed 20261101", () => {
  const a = computeAgreement(synthetic());
  assert.strictEqual(a.iterations, 10000);
  assert.strictEqual(a.seed, 20261101);
});
