"use client";
import { useEffect, useRef } from "react";
import { CorporateYappingTranslator } from "./CorporateYappingTranslator";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-viewport overlay that hosts the JD Translator, mimicking iLovePDF-s
 * tool-overlay pattern. Closes on X click, backdrop click, or Escape key.
 * Body scroll is locked while open so the underlying page stays put.
 */
export function JDTranslatorOverlay({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* Close on Escape; lock body scroll while open. */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="jd-overlay" role="dialog" aria-modal="true" aria-label="JD Translator">
      {/* Backdrop - click to close. */}
      <div className="jd-overlay-backdrop" onClick={onClose} aria-hidden />

      {/* Scrollable tool panel. */}
      <div ref={panelRef} tabIndex={-1} className="jd-overlay-panel">
        <header className="jd-overlay-header">
          <div className="jd-overlay-header-inner">
            <p className="jd-overlay-brand">
              <span className="text-red-600">ilove</span>
              <span className="text-zinc-900">employment</span>
            </p>
            <button onClick={onClose} className="jd-overlay-close" aria-label="Close JD Translator">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6l-12 12" /></svg>
            </button>
          </div>
        </header>

        <main className="jd-overlay-body">
          <CorporateYappingTranslator embedded />
        </main>
      </div>
    </div>
  );
}
