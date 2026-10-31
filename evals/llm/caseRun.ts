// ─── Deterministic case preparation ──────────────────────────────────────────
// chunkResume() assigns random ids and a timestamp on every call, so the same
// case would produce a different prompt (and prompt hash) on every run. These
// helpers replace them with content-derived ids so the generation cache can key
// on the prompt.

import { getPresetById } from "../../lib/presets";
import { DEFAULT_VAULT_LIMIT, type Preset } from "../../lib/presets/types";
import { contentHash } from "../../lib/retrieval/fusion";
import type { VaultChunk, VaultContextChunk } from "../../lib/engine/types";
import { chunkResume } from "../../lib/vault/chunker";
import { retrieveVault } from "../../lib/vault/retrieve";
import type { EvalCase } from "../cases";

/** chunkResume with ids `<resumeKey>-NN` and createdAt 0: byte-identical across calls. */
export function stableChunks(resumeText: string): VaultChunk[] {
  const key = contentHash(resumeText);
  return chunkResume(resumeText).map((c, i) => ({ ...c, id: `${key}-${String(i + 1).padStart(2, "0")}`, createdAt: 0 }));
}

export interface PreparedCase {
  case: EvalCase;
  preset: Preset;
  engine: Preset["engine"];
  vault: VaultContextChunk[];
  profile: { name: string };
}

export function prepareCase(c: EvalCase): PreparedCase {
  const preset = getPresetById(c.presetId);
  if (!preset) throw new Error(`Unknown preset ${c.presetId}`);
  const chunks = c.resume ? stableChunks(c.resume) : [];
  const vault = preset.usesVault ? retrieveVault(chunks, preset.vaultQuery(c.inputs), preset.vaultLimit ?? DEFAULT_VAULT_LIMIT) : [];
  const firstLine = c.resume?.split("\n").map((l) => l.trim()).find(Boolean);
  return { case: c, preset, engine: preset.engine, vault, profile: { name: c.profileName ?? firstLine ?? "Priya Sharma" } };
}
