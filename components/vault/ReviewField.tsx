"use client";

import type { ReactNode } from "react";
import type { FieldStatus } from "@/lib/profile/reviewState";

/** Stable DOM id for a field path, so the panel can move focus to it. */
export function fieldDomId(path: string): string {
  return `rf-${path.replace(/[^A-Za-z0-9]+/g, "-")}`;
}

export interface ReviewControlProps {
  id: string;
  "data-path": string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-labelledby"?: string;
}

interface Props {
  path: string;
  label: string;
  status: FieldStatus;
  error?: string;
  help?: string;
  /** Spans both columns of the field grid. */
  wide?: boolean;
  /** Id of the card title; makes the accessible name "Role 2 Company". */
  cardTitleId?: string;
  onToggleConfirm: () => void;
  /** Receives the props the control must spread so label, errors and hints are wired. */
  children: (props: ReviewControlProps) => ReactNode;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </svg>
  );
}

/** One labelled field row: label, state badge, the control, a per-field confirm toggle, hints. */
export function ReviewField({ path, label, status, error, help, wide, cardTitleId, onToggleConfirm, children }: Props) {
  const id = fieldDomId(path);
  const labelId = `${id}-label`;
  const lowId = `${id}-low`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const low = status === "low" || status === "empty";
  const confirmed = status === "confirmed";

  const describedBy = [low ? lowId : "", help ? helpId : "", error ? errorId : ""].filter(Boolean).join(" ");
  const controlProps: ReviewControlProps = {
    id,
    "data-path": path,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(status === "invalid" ? { "aria-invalid": true as const } : {}),
    ...(cardTitleId ? { "aria-labelledby": `${cardTitleId} ${labelId}` } : {}),
  };

  return (
    <div className="review-field" data-confidence={low ? "low" : undefined} data-state={status} data-wide={wide ? "true" : undefined}>
      <div className="review-field-head">
        <label htmlFor={id} id={labelId} className="field-label">
          {label}
          {status === "edited" && <span className="sr-only"> (edited)</span>}
        </label>
        {low && <span className="badge badge-warn">Check this</span>}
        {status === "edited" && <span className="badge badge-neutral">Edited</span>}
        {confirmed && <span className="badge badge-ok">Confirmed</span>}
      </div>
      <div className="review-field-body">
        <div className="review-field-control">{children(controlProps)}</div>
        <button
          type="button"
          className="review-confirm review-confirm-icon"
          aria-pressed={confirmed}
          aria-label={confirmed ? "Confirmed, undo" : `Confirm ${label}`}
          onClick={onToggleConfirm}
        >
          <CheckIcon />
        </button>
      </div>
      {low && (
        <span id={lowId} className="sr-only">
          Low confidence: please verify this value.
        </span>
      )}
      {help && (
        <p id={helpId} className="review-field-note">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="review-field-error">
          {error}
        </p>
      )}
      <button type="button" className="review-confirm review-confirm-text" aria-pressed={confirmed} onClick={onToggleConfirm}>
        {confirmed ? "Confirmed, undo" : "Confirm"}
        <span className="sr-only"> {label}</span>
      </button>
    </div>
  );
}
