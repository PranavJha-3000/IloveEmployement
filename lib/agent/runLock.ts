// One advance loop per run, across component instances and tabs. Client-safe, no dependencies.
// Uses the Web Locks API when the browser has it (covers other tabs); a module-level set always
// guards this tab, so a remounted ApplyWorkflow cannot start a second loop on the same run.

/** The subset of LockManager used here, so tests can pass a fake. */
export interface RunLockManager {
  request(name: string, options: { ifAvailable: true }, callback: (lock: unknown) => Promise<void>): Promise<unknown>;
}

const held = new Set<string>();

function browserLocks(): RunLockManager | null {
  if (typeof navigator === "undefined") return null;
  const locks = (navigator as { locks?: RunLockManager }).locks;
  return locks && typeof locks.request === "function" ? locks : null;
}

export type RunLockResult<T> = { ok: true; value: T } | { ok: false };

/**
 * Runs `fn` only if no other loop holds `runId`. Returns { ok: false } immediately otherwise.
 * `locks` defaults to navigator.locks; pass null to use the in-tab guard only.
 */
export async function withRunLock<T>(
  runId: string,
  fn: () => Promise<T>,
  locks: RunLockManager | null = browserLocks(),
): Promise<RunLockResult<T>> {
  if (held.has(runId)) return { ok: false };
  held.add(runId);
  try {
    if (!locks) return { ok: true, value: await fn() };
    let out: RunLockResult<T> = { ok: false };
    let ran = false;
    try {
      await locks.request(`iloveemployement-agent-run-${runId}`, { ifAvailable: true }, async (lock) => {
        if (!lock) return;
        ran = true;
        out = { ok: true, value: await fn() };
      });
    } catch (err) {
      // fn's own errors propagate; a lock manager that refuses to work falls back to the in-tab guard.
      if (ran) throw err;
      return { ok: true, value: await fn() };
    }
    return out;
  } finally {
    held.delete(runId);
  }
}
