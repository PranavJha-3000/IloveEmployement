// ─── Vault IndexedDB schema ──────────────────────────────────────────────────
// One idempotent upgrade function shared by the app (store.ts onupgradeneeded)
// and the tests. It only ever creates missing stores; it never deletes or
// recreates one, so every historical path (fresh, v2, v3) converges on v4
// without losing data.

export const DB_NAME = "iloveemployement";
export const DB_VERSION = 4;

export const STORES = {
  chunks: "chunks",
  meta: "meta",
  vectors: "vectors",
  agentRuns: "agentRuns",
  resumeVersions: "resumeVersions",
} as const;

/** Minimal surface of IDBDatabase used by the upgrade, so it can be tested with a fake. */
export interface SchemaHost {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string, options?: IDBObjectStoreParameters): unknown;
}

export function upgradeVaultSchema(db: SchemaHost, oldVersion: number): void {
  void oldVersion;
  if (!db.objectStoreNames.contains(STORES.chunks)) db.createObjectStore(STORES.chunks, { keyPath: "id" });
  if (!db.objectStoreNames.contains(STORES.meta)) db.createObjectStore(STORES.meta);
  // v2: semantic index, one embedding per chunk (keyed by chunk id, with a content hash).
  if (!db.objectStoreNames.contains(STORES.vectors)) db.createObjectStore(STORES.vectors, { keyPath: "id" });
  // v3: agent workflow runs (Phase 4)
  if (!db.objectStoreNames.contains(STORES.agentRuns)) db.createObjectStore(STORES.agentRuns, { keyPath: "id" });
  // v4: saved resume versions (Phase 5)
  if (!db.objectStoreNames.contains(STORES.resumeVersions)) db.createObjectStore(STORES.resumeVersions, { keyPath: "id" });
}
