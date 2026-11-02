// One-shot verification: the cross-encoder loads in Node and ranks the relevant
// passage first. Also gives an early (not authoritative) latency read for 20 pairs.
import { createNodeReranker } from "./reranker";

async function main() {
  const seen = new Set<string>();
  const r = await createNodeReranker({
    onProgress: (m) => {
      if (m.startsWith("logits dims")) {
        if (seen.has(m)) return;
        seen.add(m);
      }
      console.log(m);
    },
  });
  console.log(`model=${r.model} dtype=${r.dtype} transformers=${r.transformersVersion} loadMs=${r.loadMs.toFixed(0)}`);

  const query = "reduced warehouse picking errors";
  const passages = [
    "Cut warehouse picking errors by 40% by introducing barcode verification at pack stations",
    "Wrote React component tests with Testing Library and Jest",
    "Ran the monthly marketing newsletter and grew the subscriber list",
  ];
  const scores = await r.score(query, passages);
  passages.forEach((p, i) => console.log(`score ${scores[i].toFixed(4)}  ${p}`));

  const twenty = Array.from({ length: 20 }, (_, i) => `Led a team of engineers shipping backend service number ${i} with measurable results`);
  const times: number[] = [];
  for (let i = 0; i < 10; i++) {
    const t = performance.now();
    await r.score(query, twenty);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  console.log(`median ms for 20 pairs: ${((times[4] + times[5]) / 2).toFixed(1)}`);

  const best = scores.indexOf(Math.max(...scores));
  if (best !== 0) {
    console.error("FAIL: warehouse passage is not the highest scored");
    process.exit(1);
  }
  console.log("SMOKE OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
