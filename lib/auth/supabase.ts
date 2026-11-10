// Server-side Supabase REST helpers (no SDK). Verifies a bearer token and runs the daily-run RPCs.
// Server-only: uses the service-role key.

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

// New projects have a publishable key; older ones an anon key.
const publicKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function authConfigured(): boolean {
  return Boolean(url() && publicKey() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** User id for a valid `Authorization: Bearer <access_token>`, else null. */
export async function getUserId(headers: Headers, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const token = headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !authConfigured()) return null;
  try {
    const res = await fetchImpl(`${url()}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: publicKey()! },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return typeof user.id === "string" ? user.id : null;
  } catch {
    return null;
  }
}

async function rpc<T>(name: string, args: object, fetchImpl: typeof fetch): Promise<T> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetchImpl(`${url()}/rest/v1/rpc/${name}`, {
    method: "POST",
    // sb_secret_ keys are not JWTs: send them as apikey only.
    headers: { apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${name} failed (${res.status})`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Takes one run if the user is under `limit` today. Throws if Supabase is unreachable (caller fails closed). */
export async function consumeRun(userId: string, limit: number, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; used: number }> {
  const used = await rpc<number | null>("consume_daily_run", { uid: userId, lim: limit }, fetchImpl);
  return typeof used === "number" ? { ok: true, used } : { ok: false, used: limit };
}

export async function refundRun(userId: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  await rpc("refund_daily_run", { uid: userId }, fetchImpl).catch(() => undefined);
}

export async function peekRuns(userId: string, fetchImpl: typeof fetch = fetch): Promise<number> {
  return (await rpc<number>("peek_daily_run", { uid: userId }, fetchImpl).catch(() => 0)) ?? 0;
}
