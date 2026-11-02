"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export interface ArtifactEditorProps {
  label: string;
  initialSubject?: string;
  initialBody: string;
  hasEdit: boolean;
  onSave: (edit: { subject?: string; body: string }) => void;
  onCancel: () => void;
  onRevert: () => void;
}

const DESTRUCTIVE = "min-h-[44px] rounded-xl border border-[#c4241f] bg-white px-4 text-[15px] font-semibold text-[#c4241f] hover:bg-[#fef3f2]";

/** Plain-text editor. Grounding warnings are computed by the parent (saveArtifactEdit) and shown by StepCard. */
export function ArtifactEditor(p: ArtifactEditorProps) {
  const hasSubject = p.initialSubject !== undefined;
  const [subject, setSubject] = useState(p.initialSubject ?? "");
  const [body, setBody] = useState(p.initialBody);
  const [confirm, setConfirm] = useState<"revert" | "discard" | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const revertOpener = useRef<HTMLButtonElement | null>(null);
  const keepRef = useRef<HTMLButtonElement | null>(null);
  const uid = useId();

  const dirty = body !== p.initialBody || (hasSubject && subject !== (p.initialSubject ?? ""));

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);
  useEffect(() => {
    if (confirm) keepRef.current?.focus();
  }, [confirm]);

  const closeConfirm = () => {
    const returnTo = confirm === "revert" ? revertOpener.current : bodyRef.current;
    setConfirm(null);
    returnTo?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    if (confirm) closeConfirm();
    else if (dirty) setConfirm("discard");
    else p.onCancel();
  };

  return (
    <div className="agent-wrap" onKeyDown={onKeyDown}>
      {hasSubject && (
        <div style={{ marginBottom: 16 }}>
          <label className="field-label" htmlFor={`${uid}-subject`}>
            Subject
          </label>
          <input id={`${uid}-subject`} className="field-control" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
      )}
      <label className="field-label" htmlFor={`${uid}-body`}>
        {p.label}
      </label>
      <textarea
        id={`${uid}-body`}
        ref={bodyRef}
        className="field-control"
        rows={12}
        value={body}
        aria-describedby={`${uid}-help`}
        onChange={(e) => setBody(e.target.value)}
      />
      <p id={`${uid}-help`} className="field-help">
        Plain text. Figures that are not in your material get flagged when you save, but saving is never blocked.
      </p>

      <div className="agent-actionbar" role="group" aria-label="Edit actions" style={{ position: "static" }}>
        <button type="button" className="cta-primary" onClick={() => p.onSave({ ...(hasSubject ? { subject } : {}), body })}>
          Save edit
        </button>
        <button type="button" className="cta-secondary" onClick={() => (dirty ? setConfirm("discard") : p.onCancel())}>
          Cancel
        </button>
        {p.hasEdit && (
          <button
            type="button"
            className="cta-secondary"
            aria-expanded={confirm === "revert"}
            onClick={(e) => {
              revertOpener.current = e.currentTarget;
              setConfirm("revert");
            }}
          >
            Revert to generated
          </button>
        )}
        {confirm === "revert" && (
          <div className="agent-confirm" role="group" aria-label="Confirm revert">
            <p>Revert to generated: Discard your edits to this draft?</p>
            <div className="agent-confirm-actions">
              <button type="button" className={DESTRUCTIVE} onClick={p.onRevert}>
                Revert
              </button>
              <button type="button" ref={keepRef} className="cta-secondary" onClick={closeConfirm}>
                Keep my edits
              </button>
            </div>
          </div>
        )}
        {confirm === "discard" && (
          <div className="agent-confirm" role="group" aria-label="Confirm discard">
            <p>Discard your unsaved changes to this draft?</p>
            <div className="agent-confirm-actions">
              <button type="button" className={DESTRUCTIVE} onClick={p.onCancel}>
                Discard changes
              </button>
              <button type="button" ref={keepRef} className="cta-secondary" onClick={closeConfirm}>
                Keep editing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
