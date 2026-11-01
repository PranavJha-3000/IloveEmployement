"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";

export type GateMode = "gateA" | "gateB" | "skip" | "error" | "running" | "budget";

export interface OutreachOptions {
  recipientName: string;
  recipientRole: "recruiter" | "hiring-manager" | "team-member";
  channel: "linkedin-note" | "linkedin-message" | "email";
}

export interface GateBarProps {
  mode: GateMode;
  busy: boolean;
  onApprove?: () => void;
  onEdit?: () => void;
  onStop: () => void;
  onOverride?: () => void;
  onRetry?: () => void;
  onDraftOutreach?: (opts: OutreachOptions) => void;
  onDeclineOutreach?: () => void;
  canContinueBudget?: boolean;
  onContinueBudget?: () => void;
  firstButtonRef?: RefObject<HTMLButtonElement | null>;
}

type Confirm = "override" | "stop" | null;

const DESTRUCTIVE = "min-h-[44px] rounded-xl border border-[#c4241f] bg-white px-4 text-[15px] font-semibold text-[#c4241f] hover:bg-[#fef3f2] disabled:opacity-50";

export function GateBar(props: GateBarProps) {
  const { mode, busy, firstButtonRef } = props;
  const [pressed, setPressed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientRole, setRecipientRole] = useState<OutreachOptions["recipientRole"]>("recruiter");
  const [channel, setChannel] = useState<OutreachOptions["channel"]>("linkedin-message");
  const opener = useRef<HTMLButtonElement | null>(null);
  const keepRef = useRef<HTMLButtonElement | null>(null);
  const uid = useId();

  // Under 1024px the bar keeps the primary action plus one secondary; the rest move under "More".
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023.98px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // A press disables every action at once; it re-enables when the parent finishes (busy falls) or the mode changes.
  useEffect(() => setPressed(false), [mode, busy]);
  useEffect(() => setConfirm(null), [mode]);
  useEffect(() => {
    if (confirm) keepRef.current?.focus();
  }, [confirm]);

  const disabled = busy || pressed;
  const act = (fn?: () => void) => () => {
    if (disabled || !fn) return;
    setPressed(true);
    fn();
  };
  const openConfirm = (kind: Exclude<Confirm, null>) => (e: { currentTarget: HTMLButtonElement }) => {
    opener.current = e.currentTarget;
    setConfirm(kind);
  };
  const closeConfirm = () => {
    setConfirm(null);
    opener.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && confirm) {
      e.stopPropagation();
      closeConfirm();
    }
  };

  const approve = (
    <button type="button" ref={firstButtonRef} className="cta-primary" disabled={disabled} onClick={act(props.onApprove)}>
      Approve and continue
    </button>
  );

  return (
    <div className="agent-actionbar" role="group" aria-label="Step actions" onKeyDown={onKeyDown}>
      {mode === "gateA" && (
        <>
          {approve}
          <button type="button" className="cta-secondary" disabled={disabled} onClick={act(props.onEdit)}>
            Edit
          </button>
          {narrow ? (
            <details className="agent-more">
              <summary>More</summary>
              <button type="button" className="cta-secondary" disabled={disabled} onClick={act(props.onStop)}>
                Stop here
              </button>
            </details>
          ) : (
            <button type="button" className="cta-secondary" disabled={disabled} onClick={act(props.onStop)}>
              Stop here
            </button>
          )}
        </>
      )}

      {mode === "gateB" && (
        <>
          <h4 style={{ flexBasis: "100%", fontSize: 21, fontWeight: 600, lineHeight: 1.25, margin: 0 }}>Draft outreach?</h4>
          <div style={{ flexBasis: "100%", display: "grid", gap: 16 }}>
            <div>
              <label className="field-label" htmlFor={`${uid}-name`}>
                Recipient&apos;s name (optional)
              </label>
              <input id={`${uid}-name`} className="field-control" type="text" maxLength={80} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor={`${uid}-role`}>
                They are a...
              </label>
              <select id={`${uid}-role`} className="field-control" value={recipientRole} onChange={(e) => setRecipientRole(e.target.value as OutreachOptions["recipientRole"])}>
                <option value="recruiter">Recruiter</option>
                <option value="hiring-manager">Hiring manager</option>
                <option value="team-member">Engineer / team member</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor={`${uid}-channel`}>
                Channel
              </label>
              <select id={`${uid}-channel`} className="field-control" value={channel} onChange={(e) => setChannel(e.target.value as OutreachOptions["channel"])}>
                <option value="linkedin-note">LinkedIn connection note</option>
                <option value="linkedin-message">LinkedIn message</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            ref={firstButtonRef}
            className="cta-primary"
            disabled={disabled}
            onClick={act(() => props.onDraftOutreach?.({ recipientName: recipientName.trim(), recipientRole, channel }))}
          >
            Approve and continue
          </button>
          <button type="button" className="cta-secondary" disabled={disabled} onClick={act(props.onDeclineOutreach)}>
            Skip outreach
          </button>
        </>
      )}

      {mode === "skip" && (
        <>
          <button type="button" ref={firstButtonRef} className="cta-secondary" disabled={disabled} onClick={act(props.onStop)}>
            Stop here
          </button>
          <button type="button" className="cta-secondary" disabled={disabled} aria-expanded={confirm === "override"} onClick={openConfirm("override")}>
            Continue anyway
          </button>
          {confirm === "override" && (
            <div className="agent-confirm" role="group" aria-label="Confirm override">
              <p>Continue anyway: Override the SKIP verdict? The next steps will use your time and tokens even though the fit check says skip.</p>
              <div className="agent-confirm-actions">
                <button type="button" className={DESTRUCTIVE} disabled={disabled} onClick={act(props.onOverride)}>
                  Continue anyway
                </button>
                <button type="button" ref={keepRef} className="cta-secondary" onClick={closeConfirm}>
                  Keep the SKIP verdict
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === "error" && (
        <>
          <button type="button" ref={firstButtonRef} className="cta-primary" disabled={disabled} onClick={act(props.onRetry)}>
            Retry this step
          </button>
          <button type="button" className="cta-secondary" disabled={disabled} onClick={act(props.onStop)}>
            Stop run
          </button>
        </>
      )}

      {mode === "running" && (
        <>
          <button type="button" ref={firstButtonRef} className="cta-secondary" aria-expanded={confirm === "stop"} onClick={openConfirm("stop")}>
            Stop run
          </button>
          {confirm === "stop" && (
            <div className="agent-confirm" role="group" aria-label="Confirm stop">
              <p>Stop run: Stop this application? Finished steps stay in your Career Vault and you can resume later.</p>
              <div className="agent-confirm-actions">
                <button
                  type="button"
                  className={DESTRUCTIVE}
                  onClick={() => {
                    setConfirm(null);
                    props.onStop();
                  }}
                >
                  Stop run
                </button>
                <button type="button" ref={keepRef} className="cta-secondary" onClick={closeConfirm}>
                  Keep going
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === "budget" && props.canContinueBudget && (
        <button type="button" ref={firstButtonRef} className="cta-secondary" disabled={disabled} onClick={act(props.onContinueBudget)}>
          Continue with a new budget
        </button>
      )}
    </div>
  );
}
