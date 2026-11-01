// ─── Career Vault storage (browser only) ─────────────────────────────────────
// Local-first: everything lives in this browser's IndexedDB. Nothing is sent
// anywhere until a tool run, and then only the chunks retrieved for that run.
// Every call is wrapped so a blocked/private-mode IndexedDB degrades to an
// empty vault instead of breaking the tools.

import type { VaultChunk, VaultProfile } from "../engine/types";
import { isAgentRunRecord, toStorable } from "../agent/record";
import type { AgentRunRecord } from "../agent/types";

const DB_NAME = "iloveemployement";
const DB_VERSION = 3;
const CHUNKS = "chunks";
const META = "meta";
const VECTORS = "vectors";
const AGENT_RUNS = "agentRuns";
const EXPORT_FORMAT = "iloveemployement-vault@1";

export const EMPTY_PROFILE: VaultProfile = { name: "", headline: "", location: "", targetRole: "", links: "" };

/** Minimal surface of IDBDatabase used by the upgrade, so it can be tested with a fake. */
export interface VaultUpgradeTarget {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string, options?: IDBObjectStoreParameters): unknown;
}

/** Creates any missing store. Never deletes or recreates an existing one. */
export function upgradeVaultDb(db: VaultUpgradeTarget, oldVersion: number): void {
  void oldVersion;
  if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS, { keyPath: "id" });
  if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
  // v2: semantic index, one embedding per chunk (keyed by chunk id, with a content hash).
  if (!db.objectStoreNames.contains(VECTORS)) db.createObjectStore(VECTORS, { keyPath: "id" });
  // v3: agent workflow runs (Phase 4)
  if (!db.objectStoreNames.contains(AGENT_RUNS)) db.createObjectStore(AGENT_RUNS, { keyPath: "id" });
  // Phase 5 adds its v4 store after this block.
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => upgradeVaultDb(req.result, event.oldVersion);
    req.onsuccess = () => {
      const db = req.result;
      // Let another tab's upgrade proceed instead of blocking on this connection.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    t.onerror = () => reject(t.error);
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
}

export function buildVaultExport(parts: VaultExportParts, exportedAt: string): string {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      exportedAt,
      profile: parts.profile,
      chunks: parts.chunks,
      agentRuns: parts.agentRuns.map(toStorable),
    },
    null,
    2,
  );
}

export function parseVaultImport(json: string): {
  profile?: VaultProfile;
  chunks: VaultChunk[];
  agentRuns: AgentRunRecord[];
} {
  const data = JSON.parse(json) as {
    format?: string;
    profile?: VaultProfile;
    chunks?: VaultChunk[];
    agentRuns?: unknown;
  };
  if (data.format !== EXPORT_FORMAT || !Array.isArray(data.chunks)) {
    throw new Error("That file isn't an IloveEmployement vault export.");
  }
  const chunks = data.chunks.filter((c) => typeof c?.id === "string" && typeof c?.text === "string");
  // Older exports have no agentRuns; every imported run is validated and rebuilt by whitelist.
  const agentRuns = Array.isArray(data.agentRuns) ? data.agentRuns.filter(isAgentRunRecord).map(toStorable) : [];
  return { profile: data.profile, chunks, agentRuns };
}

export async function exportVault(): Promise<string> {
  const [chunks, profile, agentRuns] = await Promise.all([loadChunks(), loadProfile(), listAgentRuns()]);
  return buildVaultExport({ profile, chunks, agentRuns }, new Date().toISOString());
}

export async function importVault(json: string): Promise<{ chunks: number; agentRuns: number }> {
  const { profile, chunks, agentRuns } = parseVaultImport(json);
  await saveChunks(chunks);
  if (profile) await saveProfile({ ...EMPTY_PROFILE, ...profile });
  for (const r of agentRuns) await saveAgentRun(r);
  return { chunks: chunks.length, agentRuns: agentRuns.length };
}

/** Notifies open tool pages that the vault changed in another tab or component. */
export const VAULT_EVENT = "ile:vault-changed";

export function announceVaultChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(VAULT_EVENT));
}
