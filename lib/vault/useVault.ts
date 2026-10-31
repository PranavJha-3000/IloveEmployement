"use client";

import { useCallback, useEffect, useState } from "react";
import type { VaultChunk, VaultProfile } from "../engine/types";
import { EMPTY_PROFILE, loadChunks, loadProfile, VAULT_EVENT } from "./store";

/** Live view of the Career Vault; reloads when any component announces a change. */
export function useVault() {
  const [chunks, setChunks] = useState<VaultChunk[]>([]);
  const [profile, setProfile] = useState<VaultProfile>(EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [c, p] = await Promise.all([loadChunks(), loadProfile()]);
    setChunks(c);
    setProfile(p);
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

  return { chunks, profile, loaded, reload };
}
