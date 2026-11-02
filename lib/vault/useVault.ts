"use client";

import { useCallback, useEffect, useState } from "react";
import type { VaultChunk, VaultProfile } from "../engine/types";
import type { ConfirmedProfile } from "../profile/schema";
import { EMPTY_PROFILE, loadChunks, loadProfile, loadResumeVersions, loadStructuredProfile, VAULT_EVENT } from "./store";
import type { ResumeVersion } from "./versions";

/** Live view of the Career Vault; reloads when any component announces a change. */
export function useVault() {
  const [chunks, setChunks] = useState<VaultChunk[]>([]);
  const [profile, setProfile] = useState<VaultProfile>(EMPTY_PROFILE);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [structuredProfile, setStructuredProfile] = useState<ConfirmedProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [c, p, v, sp] = await Promise.all([loadChunks(), loadProfile(), loadResumeVersions(), loadStructuredProfile()]);
    setChunks(c);
    setProfile(p);
    setVersions(v);
    setStructuredProfile(sp);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
    const onChange = () => void reload();
    window.addEventListener(VAULT_EVENT, onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener(VAULT_EVENT, onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [reload]);

  return { chunks, profile, versions, structuredProfile, loaded, reload };
}
