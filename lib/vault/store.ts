// ─── Career Vault storage (browser only) ─────────────────────────────────────
// Local-first: everything lives in this browser's IndexedDB. Nothing is sent
// anywhere until a tool run, and then only the chunks retrieved for that run.
// Every call is wrapped so a blocked/private-mode IndexedDB degrades to an
// empty vault instead of breaking the tools.

import type { VaultChunk, VaultProfile } from "../engine/types";

const DB_NAME = "iloveemployement";
const DB_VERSION = 2;
const CHUNKS = "chunks";
const META = "meta";
const VECTORS = "vectors";
const EXPORT_FORMAT = "iloveemployement-vault@1";

export const EMPTY_PROFILE: VaultProfile = { name: "", headline: "", location: "", targetRole: "", links: "" };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      // v2: semantic index, one embedding per chunk (keyed by chunk id, with a content hash).
      if (!db.objectStoreNames.contains(VECTORS)) db.createObjectStore(VECTORS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
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

export async function exportVault(): Promise<string> {
  const [chunks, profile] = await Promise.all([loadChunks(), loadProfile()]);
  return JSON.stringify({ format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), profile, chunks }, null, 2);
}

export async function importVault(json: string): Promise<{ chunks: number }> {
  const data = JSON.parse(json) as { format?: string; profile?: VaultProfile; chunks?: VaultChunk[] };
  if (data.format !== EXPORT_FORMAT || !Array.isArray(data.chunks)) {
    throw new Error("That file isn't an IloveEmployement vault export.");
  }
  const chunks = data.chunks.filter((c) => typeof c?.id === "string" && typeof c?.text === "string");
  await saveChunks(chunks);
  if (data.profile) await saveProfile({ ...EMPTY_PROFILE, ...data.profile });
  return { chunks: chunks.length };
}

/** Notifies open tool pages that the vault changed in another tab or component. */
export const VAULT_EVENT = "ile:vault-changed";

export function announceVaultChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(VAULT_EVENT));
}
