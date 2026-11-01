// Assembles the profile extraction dataset: authored profiles rendered into
// resume text, plus the three synthetic retrieval resumes with hand-written gold.
import { contentHash } from "../../../lib/retrieval/fusion";
import { TAXONOMY_VERSION } from "../../../lib/skills/taxonomy";
import { RESUMES } from "../../retrieval/dataset/resumes";
import { AUTHORED } from "./gold";
import { renderResume, RENDER_STYLES } from "./render";
import { SYNTHETIC_GOLD } from "./synthetic-gold";
import type { GoldResume } from "./types";

export function loadProfileDataset(): GoldResume[] {
  const out: GoldResume[] = [];
  for (const a of AUTHORED) {
    const style = RENDER_STYLES.find((s) => s.id === a.styleId);
    if (!style) throw new Error(`Unknown render style "${a.styleId}" for ${a.id}`);
    out.push({ id: a.id, source: "rendered", styleId: style.id, text: renderResume(a.gold, style, { summary: a.summary }), gold: a.gold });
  }
  for (const r of RESUMES) {
    out.push({ id: r.id, source: "synthetic", styleId: null, text: r.text, gold: SYNTHETIC_GOLD[r.id as keyof typeof SYNTHETIC_GOLD] });
  }
  return out;
}

export function profileDatasetFingerprint(ds: GoldResume[] = loadProfileDataset()): string {
  return contentHash(JSON.stringify({ taxonomy: TAXONOMY_VERSION, items: ds.map((d) => ({ id: d.id, text: d.text, gold: d.gold })) }));
}
