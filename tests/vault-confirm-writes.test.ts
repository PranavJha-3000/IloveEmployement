// Offline tests of the atomic "Confirm profile" write (CR-01).
import assert from "node:assert";
import { test } from "node:test";
import type { VaultChunk } from "../lib/engine/types";
import { planConfirm } from "../lib/profile/confirm";
import { emptyProfile } from "../lib/profile/schema";
import { applyWrites, confirmWrites, type VaultWrite, type WriteHost } from "../lib/vault/store";
import { STORES } from "../lib/vault/schema";

const chunk = (id: string, source: VaultChunk["source"]): VaultChunk =>
  ({ id, source, kind: "bullet", title: id, text: `text ${id}`, createdAt: 1 }) as VaultChunk;

function plan(text: string | null) {
  const p = emptyProfile();
  p.contact.name = "Asha Rao";
  return planConfirm({ profile: p, method: "deterministic", resumeText: text, existingVaultProfile: { name: "", headline: "", location: "", targetRole: "", links: "" }, now: 1000 });
}

/** A fake database with rollback: writes land in a staging copy and only reach `data` when the transaction completes. */
function fakeDb(failOnPutNumber = Infinity) {
  const data = new Map<string, Map<IDBValidKey, unknown>>();
  let transactions = 0;
  const host: WriteHost = {
    transaction(stores) {
      transactions += 1;
      const staged = new Map(stores.map((s) => [s, new Map(data.get(s) ?? [])]));
      let puts = 0;
      const t = {
        error: null as DOMException | null,
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onabort: null as (() => void) | null,
        objectStore(name: string) {
          const s = staged.get(name);
          if (!s) throw new Error(`store ${name} not in transaction`);
          return {
            put(value: { id?: string }, key?: IDBValidKey) {
              puts += 1;
              if (puts >= failOnPutNumber) {
                t.error = new DOMException("Quota exceeded", "QuotaExceededError");
                queueMicrotask(() => t.onabort?.());
                failOnPutNumber = Infinity;
                aborted = true;
                return;
              }
              s.set(key ?? (value.id as string), value);
            },
            delete(key: IDBValidKey) {
              s.delete(key);
            },
          };
        },
      };
      let aborted = false;
      queueMicrotask(() => {
        if (aborted) return;
        for (const [name, s] of staged) data.set(name, s);
        t.oncomplete?.();
      });
      return t as unknown as ReturnType<WriteHost["transaction"]>;
    },
  };
  return { host, data, count: () => transactions };
}

test("confirmWrites replaces only resume chunks and their vectors, then writes profile, quick profile and version", () => {
  const existing = [chunk("r1", "resume"), chunk("m1", "manual")];
  const writes = confirmWrites({ ...plan("Asha Rao\n- Built the API"), newChunks: [chunk("r2", "resume")], existingChunks: existing });
  const summary = writes.map((w) => `${w.op}:${w.store}:${String(w.op === "delete" ? w.key : (w.key ?? (w.value as { id: string }).id))}`);
  assert.deepStrictEqual(summary.slice(0, 3), [`delete:${STORES.chunks}:r1`, `delete:${STORES.vectors}:r1`, `put:${STORES.chunks}:r2`]);
  assert.ok(!summary.some((s) => s.includes("m1")), "manual chunks are kept");
  assert.ok(summary.includes(`put:${STORES.meta}:structuredProfile`));
  assert.ok(summary.includes(`put:${STORES.meta}:profile`));
  assert.ok(summary.some((s) => s.startsWith(`put:${STORES.resumeVersions}:base-`)));
});

test("confirmWrites without new chunks leaves chunks alone and writes no version for a reopened profile", () => {
  const writes = confirmWrites({ ...plan(null), newChunks: null, existingChunks: [chunk("r1", "resume")] });
  assert.ok(writes.every((w) => w.store === STORES.meta));
});

test("confirmWrites validates before writing anything", () => {
  const bad = plan("Asha Rao");
  bad.confirmed.profile.contact.name = "x".repeat(500);
  assert.throws(() => confirmWrites({ ...bad, newChunks: null, existingChunks: [] }));
});

test("applyWrites uses one transaction across every store", async () => {
  const db = fakeDb();
  await applyWrites(db.host, confirmWrites({ ...plan("Asha Rao\n- Built the API"), newChunks: [chunk("r2", "resume")], existingChunks: [] }));
  assert.strictEqual(db.count(), 1);
  assert.ok(db.data.get(STORES.chunks)?.has("r2"));
});

test("a failure part-way through leaves the old chunks and profile intact", async () => {
  const db = fakeDb();
  const old: VaultWrite[] = [
    { store: STORES.chunks, op: "put", value: chunk("r1", "resume") },
    { store: STORES.meta, op: "put", value: { name: "Old" }, key: "profile" },
  ];
  await applyWrites(db.host, old);
  const failing = fakeDb(2);
  failing.data.set(STORES.chunks, new Map(db.data.get(STORES.chunks)));
  failing.data.set(STORES.meta, new Map(db.data.get(STORES.meta)));
  const writes = confirmWrites({ ...plan("Asha Rao\n- Built the API"), newChunks: [chunk("r2", "resume"), chunk("r3", "resume")], existingChunks: [chunk("r1", "resume")] });
  await assert.rejects(applyWrites(failing.host, writes), /Quota/);
  assert.ok(failing.data.get(STORES.chunks)?.has("r1"), "old resume chunk survives");
  assert.ok(!failing.data.get(STORES.chunks)?.has("r2"), "no new chunk was committed");
  assert.deepStrictEqual(failing.data.get(STORES.meta)?.get("profile"), { name: "Old" });
});

test("confirming the same resume twice targets the same base version id", () => {
  assert.strictEqual(plan("Asha Rao\n- Built the API").baseVersion?.id, plan("Asha Rao\n- Built the API").baseVersion?.id);
  assert.notStrictEqual(plan("Asha Rao\n- Built the API").baseVersion?.id, plan("Asha Rao\n- Built the queue").baseVersion?.id);
});
