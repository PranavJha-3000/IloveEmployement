// Fingerprint of the case set: changes when any case's inputs, resume, tags or
// expect function change, so a report can show which case set produced it.

import { contentHash } from "../../lib/retrieval/fusion";
import type { EvalCase } from "../cases";

export function caseFingerprint(cases: EvalCase[]): string {
  return contentHash(
    JSON.stringify(
      cases.map((c) => ({
        id: c.id,
        presetId: c.presetId,
        description: c.description,
        inputs: c.inputs,
        resume: c.resume,
        profileName: c.profileName,
        tags: c.tags,
        expect: c.expect.toString(),
      })),
    ),
  );
}
