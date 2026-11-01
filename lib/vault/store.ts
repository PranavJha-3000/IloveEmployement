// ─── Career Vault storage (browser only) ─────────────────────────────────────
// Local-first: everything lives in this browser's IndexedDB. Nothing is sent
// anywhere until a tool run, and then only the chunks retrieved for that run.
// Every call is wrapped so a blocked/private-mode IndexedDB degrades to an
// empty vault instead of breaking the tools.

import type { VaultChunk, VaultProfile } from "../engine/types";
import { isAgentRunRecord, toStorable } from "../agent/record";
import type { AgentRunRecord } from "../agent/types";
import { ConfirmedProfileSchema, type ConfirmedProfile } from "../profile/schema";
import { DB_NAME, DB_VERSION, STORES, upgradeVaultSchema, type SchemaHost } from "./schema";
import { ResumeVersionSchema, sanitizeImportedVersions, type ResumeVersion } from "./versions";

const CHUNKS = STORES.chunks;
const META = STORES.meta;
const VECTORS = STORES.vectors;
const AGENT_RUNS = STORES.agentRuns;
const RESUME_VERSIONS = STORES.resumeVersions;
const STRUCTURED_PROFILE_KEY = "structuredProfile";
const EXPORT_FORMAT = "iloveemployement-vault@1";

export const EMPTY_PROFILE: VaultProfile = { name: "", headline: "", location: "", targetRole: "", links: "" };

/** Phase 4's names for the upgrade; the logic lives in schema.ts so every path reaches v4. */
export type VaultUpgradeTarget = SchemaHost;
export const upgradeVaultDb = upgradeVaultSchema;

export const VAULT_BLOCKED_MESSAGE = "Close other IloveEmployement tabs to finish the update, then reload.";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    let settled = false;
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => upgradeVaultSchema(req.result, event.oldVersion);
    req.onsuccess = () => {
      const db = req.result;
      // Let another tab's upgrade proceed instead of blocking on this connection.
      db.onversionchange = () => db.close();
      // Opened after we already gave up on a blocked upgrade: do not hold the connection.
      if (settled) return db.close();
      settled = true;
      resolve(db);
    };
    // A tab still running older code holds the old version open: fail (callers degrade) instead of hanging.
    req.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error(VAULT_BLOCKED_MESSAGE));
    };
    req.onerror = () => {
      settled = true;
      reject(req.error);
    };
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    t.onerror = () => reject(t.error);
    // QuotaExceededError aborts the transaction without an error event on it.
    t.onabort = () => reject(t.error ?? new Error("Transaction aborted"));
  });
}

export async function loadChunks(): Promise<VaultChunk[]> {
  try {
    const all = (await tx<VaultChunk[]>(CHUNKS, "readonly", (s) => s.getAll())) ?? [];
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function saveChunks(chunks: VaultChunk[]): Promise<void> {
  await tx(CHUNKS, "readwrite", (s) => {
    for (const c of chunks) s.put(c);
  });
}

export async function deleteChunk(id: string): Promise<void> {
  await tx(CHUNKS, "readwrite", (s) => s.delete(id));
  await tx(VECTORS, "readwrite", (s) => s.delete(id));
}

export async function deleteChunksFromSource(source: VaultChunk["source"]): Promise<void> {
  const all = await loadChunks();
  const doomed = all.filter((c) => c.source === source).map((c) => c.id);
  await tx(CHUNKS, "readwrite", (s) => {
    for (const id of doomed) s.delete(id);
  });
  await tx(VECTORS, "readwrite", (s) => {
    for (const id of doomed) s.delete(id);
  });
}

export async function loadProfile(): Promise<VaultProfile> {
  try {
    const p = await tx<VaultProfile>(META, "readonly", (s) => s.get("profile"));
    return { ...EMPTY_PROFILE, ...(p ?? {}) };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export async function saveProfile(profile: VaultProfile): Promise<void> {
  await tx(META, "readwrite", (s) => s.put(profile, "profile"));
}

export async function clearVault(): Promise<void> {
  await tx(CHUNKS, "readwrite", (s) => s.clear());
  await tx(META, "readwrite", (s) => s.clear());
  await tx(VECTORS, "readwrite", (s) => s.clear());
  await tx(AGENT_RUNS, "readwrite", (s) => s.clear());
  await tx(RESUME_VERSIONS, "readwrite", (s) => s.clear());
}

// ─── Structured profile (Phase 5) ────────────────────────────────────────────

export async function loadStructuredProfile(): Promise<ConfirmedProfile | null> {
  try {
    const raw = await tx<unknown>(META, "readonly", (s) => s.get(STRUCTURED_PROFILE_KEY));
    const parsed = ConfirmedProfileSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveStructuredProfile(p: ConfirmedProfile): Promise<void> {
  const valid = ConfirmedProfileSchema.parse(p);
  await tx(META, "readwrite", (s) => s.put(valid, STRUCTURED_PROFILE_KEY));
}

// ─── Resume versions (Phase 5) ───────────────────────────────────────────────

/** Newest first; entries that no longer validate are skipped. */
export async function loadResumeVersions(): Promise<ResumeVersion[]> {
  try {
    const all = (await tx<unknown[]>(RESUME_VERSIONS, "readonly", (s) => s.getAll())) ?? [];
    const out: ResumeVersion[] = [];
    for (const item of all) {
      const r = ResumeVersionSchema.safeParse(item);
      if (r.success) out.push(r.data);
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/** Put by id: saving the same id overwrites it. */
export async function saveResumeVersion(v: ResumeVersion): Promise<void> {
  const valid = ResumeVersionSchema.parse(v);
  await tx(RESUME_VERSIONS, "readwrite", (s) => s.put(valid));
}

export async function deleteResumeVersion(id: string): Promise<void> {
  await tx(RESUME_VERSIONS, "readwrite", (s) => s.delete(id));
}

// ─── Agent runs ──────────────────────────────────────────────────────────────

export async function saveAgentRun(record: AgentRunRecord): Promise<void> {
  await tx(AGENT_RUNS, "readwrite", (s) => s.put(toStorable(record)));
}

export async function loadAgentRun(id: string): Promise<AgentRunRecord | undefined> {
  try {
    const r = await tx<unknown>(AGENT_RUNS, "readonly", (s) => s.get(id));
    return isAgentRunRecord(r) ? r : undefined;
  } catch {
    return undefined;
  }
}

export async function listAgentRuns(): Promise<AgentRunRecord[]> {
  try {
    const all = (await tx<unknown[]>(AGENT_RUNS, "readonly", (s) => s.getAll())) ?? [];
    return all.filter(isAgentRunRecord).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function deleteAgentRun(id: string): Promise<void> {
  await tx(AGENT_RUNS, "readwrite", (s) => s.delete(id));
}

// ─── Semantic index ──────────────────────────────────────────────────────────

export interface StoredVector {
  id: string;
  /** Hash of the text that was embedded; a mismatch means the chunk changed. */
  hash: string;
  vector: number[];
}

export async function loadVectors(): Promise<StoredVector[]> {
  try {
    return (await tx<StoredVector[]>(VECTORS, "readonly", (s) => s.getAll())) ?? [];
  } catch {
    return [];
  }
}

export async function saveVectors(vectors: StoredVector[]): Promise<void> {
  await tx(VECTORS, "readwrite", (s) => {
    for (const v of vectors) s.put(v);
  });
}

// ─── Export / import ─────────────────────────────────────────────────────────

export interface VaultExportParts {
  profile: VaultProfile;
  chunks: VaultChunk[];
  agentRuns: AgentRunRecord[];
  /** Phase 5; optional so callers that predate it still compile. */
  structuredProfile?: ConfirmedProfile | null;
  resumeVersions?: ResumeVersion[];
}

export function buildVaultExport(parts: VaultExportParts, exportedAt: string): string {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      exportedAt,
      profile: parts.profile,
      chunks: parts.chunks,
      agentRuns: parts.agentRuns.map(toStorable),
      structuredProfile: parts.structuredProfile ?? null,
      resumeVersions: parts.resumeVersions ?? [],
    },
    null,
    2,
  );
}

export function parseVaultImport(json: string): {
  profile?: VaultProfile;
  chunks: VaultChunk[];
  agentRuns: AgentRunRecord[];
  structuredProfile: ConfirmedProfile | null;
  versions: ResumeVersion[];
  versionsDropped: number;
} {
  const data = JSON.parse(json) as {
    format?: string;
    profile?: VaultProfile;
    chunks?: VaultChunk[];
    agentRuns?: unknown;
    structuredProfile?: unknown;
    resumeVersions?: unknown;
  };
  if (data.format !== EXPORT_FORMAT || !Array.isArray(data.chunks)) {
    throw new Error("That file isn't an IloveEmployement vault export.");
  }
  const chunks = data.chunks.filter((c) => typeof c?.id === "string" && typeof c?.text === "string");
  // Older exports have no agentRuns; every imported run is validated and rebuilt by whitelist.
  const agentRuns = Array.isArray(data.agentRuns) ? data.agentRuns.filter(isAgentRunRecord).map(toStorable) : [];
  // Phase 5 keys are optional; every version and the profile are validated, invalid ones are dropped.
  const { versions, dropped } = sanitizeImportedVersions(data.resumeVersions);
  const sp = ConfirmedProfileSchema.safeParse(data.structuredProfile);
  return {
    profile: data.profile,
    chunks,
    agentRuns,
    structuredProfile: sp.success ? sp.data : null,
    versions,
    versionsDropped: dropped,
  };
}

export async function exportVault(): Promise<string> {
  const [chunks, profile, agentRuns, structuredProfile, resumeVersions] = await Promise.all([
    loadChunks(),
    loadProfile(),
    listAgentRuns(),
    loadStructuredProfile(),
    loadResumeVersions(),
  ]);
  return buildVaultExport({ profile, chunks, agentRuns, structuredProfile, resumeVersions }, new Date().toISOString());
}

/** An imported run only replaces a local copy that is older; a backup never rolls back newer work. */
export function shouldImportRun(existing: Pick<AgentRunRecord, "updatedAt"> | undefined, incoming: AgentRunRecord): boolean {
  return !existing || incoming.updatedAt > existing.updatedAt;
}

export async function importVault(
  json: string,
): Promise<{ chunks: number; agentRuns: number; keptNewer: number; versions: number; versionsDropped: number }> {
  const { profile, chunks, agentRuns, structuredProfile, versions, versionsDropped } = parseVaultImport(json);
  await saveChunks(chunks);
  if (profile) await saveProfile({ ...EMPTY_PROFILE, ...profile });
  let imported = 0;
  for (const r of agentRuns) {
    if (!shouldImportRun(await loadAgentRun(r.id), r)) continue;
    await saveAgentRun(r);
    imported += 1;
  }
  for (const v of versions) await saveResumeVersion(v);
  if (structuredProfile) await saveStructuredProfile(structuredProfile);
  return { chunks: chunks.length, agentRuns: imported, keptNewer: agentRuns.length - imported, versions: versions.length, versionsDropped };
}

/** Notifies open tool pages that the vault changed in another tab or component. */
export const VAULT_EVENT = "ile:vault-changed";

export function announceVaultChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(VAULT_EVENT));
}
