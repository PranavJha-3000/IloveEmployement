// Prints every chunk of every synthetic resume so labels can be written with
// distinctive text fragments. Run: npx tsc -p tsconfig.eval.json && node .eval-build/evals/retrieval/dump.js
import { chunkResume } from "../../lib/vault/chunker";
import { RESUMES } from "./dataset/resumes";

function main(): void {
  for (const resume of RESUMES) {
    const chunks = chunkResume(resume.text);
    console.log(`\n=== ${resume.id} (${resume.seniority}, ${resume.domain}) — ${chunks.length} chunks ===`);
    chunks.forEach((c, i) => {
      console.log(`\n[${i}] kind=${c.kind} title=${c.title}`);
      console.log(c.text);
    });
  }
}

main();
