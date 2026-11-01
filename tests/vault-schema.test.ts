// Offline tests of the single v4 upgrade path (fresh, v2 and v3 installs).
import assert from "node:assert";
import { test } from "node:test";
import { DB_VERSION, STORES, upgradeVaultSchema } from "../lib/vault/schema";

interface FakeStore {
  keyPath?: string;
  data: Map<string, unknown>;
}

function fakeDb(initial: Record<string, FakeStore> = {}) {
  const stores = new Map<string, FakeStore>(Object.entries(initial));
  const calls: string[] = [];
  return {
    stores,
    calls,
    db: {
      objectStoreNames: { contains: (n: string) => stores.has(n) },
      createObjectStore(name: string, options?: { keyPath?: string | string[] }) {
        calls.push(`create:${name}`);
        if (stores.has(name)) throw new Error("ConstraintError");
        stores.set(name, { keyPath: options?.keyPath as string | undefined, data: new Map() });
        return {};
      },
    },
  };
}

const v2Stores = (): Record<string, FakeStore> => ({
  chunks: { keyPath: "id", data: new Map([["c1", { id: "c1", text: "hello" }]]) },
  meta: { data: new Map([["profile", { name: "A" }]]) },
  vectors: { keyPath: "id", data: new Map([["c1", { id: "c1", hash: "h", vector: [1] }]]) },
});

const v3Stores = (): Record<string, FakeStore> => ({
  ...v2Stores(),
  agentRuns: { keyPath: "id", data: new Map([["r1", { id: "r1", updatedAt: 3 }]]) },
});

const snapshot = (stores: Map<string, FakeStore>, skip: string[]) =>
  JSON.stringify([...stores].filter(([k]) => !skip.includes(k)).map(([k, v]) => [k, v.keyPath, [...v.data]]));

test("DB_VERSION is 4", () => {
  assert.equal(DB_VERSION, 4);
});

test("fresh install creates all five stores with the right keyPaths", () => {
  const f = fakeDb();
  upgradeVaultSchema(f.db, 0);
  assert.deepEqual([...f.stores.keys()].sort(), ["agentRuns", "chunks", "meta", "resumeVersions", "vectors"]);
  assert.equal(f.stores.get(STORES.resumeVersions)?.keyPath, "id");
  assert.equal(f.stores.get(STORES.agentRuns)?.keyPath, "id");
  assert.equal(f.stores.get(STORES.chunks)?.keyPath, "id");
  assert.equal(f.stores.get(STORES.meta)?.keyPath, undefined);
});

test("v2 -> v4 creates only agentRuns and resumeVersions and keeps data", () => {
  const f = fakeDb(v2Stores());
  const before = snapshot(f.stores, []);
  upgradeVaultSchema(f.db, 2);
  assert.deepEqual(f.calls, ["create:agentRuns", "create:resumeVersions"]);
  assert.equal(snapshot(f.stores, ["agentRuns", "resumeVersions"]), before);
  assert.equal(f.stores.get("resumeVersions")?.data.size, 0);
});

test("v3 -> v4 creates only resumeVersions and keeps agent runs", () => {
  const f = fakeDb(v3Stores());
  const before = snapshot(f.stores, []);
  upgradeVaultSchema(f.db, 3);
  assert.deepEqual(f.calls, ["create:resumeVersions"]);
  assert.equal(snapshot(f.stores, ["resumeVersions"]), before);
  assert.deepEqual([...(f.stores.get("agentRuns")?.data.keys() ?? [])], ["r1"]);
});

test("a second run is a no-op", () => {
  const f = fakeDb();
  upgradeVaultSchema(f.db, 0);
  const n = f.calls.length;
  assert.doesNotThrow(() => upgradeVaultSchema(f.db, 4));
  assert.equal(f.calls.length, n);
});
