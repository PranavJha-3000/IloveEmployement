"use client";
// Browser sign-in against Supabase Auth (email code, no password, no SDK).
// The session lives in localStorage; the access token is sent as a bearer on run requests.

import { useSyncExternalStore } from "react";

const KEY = "ile:session";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface Session {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch seconds
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as Session | null;
  } catch {
    return null;
  }
}

function write(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: signed in for this page view only
  }
  emit();
}

async function auth(path: string, body: object): Promise<Record<string, unknown>> {
  if (!URL_ || !ANON) throw new Error("Sign-in isn't configured on this deployment.");
  const res = await fetch(`${URL_}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(json.msg ?? json.error_description ?? json.message ?? "Sign-in failed. Try again."));
  return json;
}

function toSession(email: string, j: Record<string, unknown>): Session {
  return {
    email,
    accessToken: String(j.access_token),
    refreshToken: String(j.refresh_token),
    expiresAt: Number(j.expires_at) || Math.floor(Date.now() / 1000) + Number(j.expires_in || 3600),
  };
}

export async function sendCode(email: string): Promise<void> {
  await auth("otp", { email, create_user: true });
}

export async function verifyCode(email: string, code: string): Promise<void> {
  write(toSession(email, await auth("verify", { type: "email", email, token: code.trim() })));
}

export function signOut() {
  write(null);
}

/** `{ Authorization }` for the current session (refreshed when close to expiry), or `{}` when signed out. */
export async function authHeaders(): Promise<Record<string, string>> {
  let s = read();
  if (!s) return {};
  if (s.expiresAt - 60 < Date.now() / 1000) {
    try {
      s = toSession(s.email, await auth("token?grant_type=refresh_token", { refresh_token: s.refreshToken }));
      write(s);
    } catch {
      write(null);
      return {};
    }
  }
  return { Authorization: `Bearer ${s.accessToken}` };
}

let cached: { raw: string | null; email: string | null } = { raw: null, email: null };
function snapshot(): string | null {
  const raw = localStorage.getItem(KEY);
  if (raw !== cached.raw) {
    cached = { raw, email: read()?.email ?? null };
  }
  return cached.email;
}

export function useSessionEmail(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => {
      try {
        return snapshot();
      } catch {
        return null;
      }
    },
    () => null,
  );
}
