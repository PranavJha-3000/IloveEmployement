"use client";

import { useId } from "react";
import { AGENT_JD_MAX, AGENT_NOTES_MAX, AGENT_TEXT_MAX, AGENT_URL_MAX } from "@/lib/agent/config";
import { isJobUrl, JOB_URL_ERROR } from "@/lib/agent/record";
import type { AgentJob } from "@/lib/agent/types";

export interface JobInputProps {
  value: AgentJob;
  onChange: (next: AgentJob) => void;
  disabled?: boolean;
}

export function JobInput({ value, onChange, disabled = false }: JobInputProps) {
  const uid = useId();
  const set = <K extends keyof AgentJob>(key: K, v: AgentJob[K]) => onChange({ ...value, [key]: v });
  const jdHelp = `${uid}-jd-help`;
  const hasExtras = Boolean(value.url?.trim() || value.notes?.trim());
  const urlError = isJobUrl(value.url) ? "" : JOB_URL_ERROR;
  const urlHelp = `${uid}-url-error`;

  return (
    <div className="space-y-5">
      <div>
        <label className="field-label" htmlFor={`${uid}-jd`}>
          Job description <span className="text-red-600">*</span>
        </label>
        <textarea
          id={`${uid}-jd`}
          className="field-control"
          rows={10}
          required
          disabled={disabled}
          maxLength={AGENT_JD_MAX}
          value={value.description}
          placeholder="Paste the full job posting"
          aria-describedby={jdHelp}
          onChange={(e) => set("description", e.target.value)}
        />
        <p id={jdHelp} className="field-help">
          Screened for hidden instructions before the AI reads it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`${uid}-company`}>
            Company
          </label>
          <input
            id={`${uid}-company`}
            className="field-control"
            type="text"
            disabled={disabled}
            maxLength={AGENT_TEXT_MAX}
            value={value.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`${uid}-role`}>
            Role
          </label>
          <input
            id={`${uid}-role`}
            className="field-control"
            type="text"
            disabled={disabled}
            maxLength={AGENT_TEXT_MAX}
            value={value.role}
            onChange={(e) => set("role", e.target.value)}
          />
        </div>
      </div>

      <details className="agent-more-details" open={hasExtras || undefined}>
        <summary>More details (optional)</summary>
        <div className="mt-4 space-y-4">
          <div>
            <label className="field-label" htmlFor={`${uid}-url`}>
              Job link
            </label>
            <input
              id={`${uid}-url`}
              className="field-control"
              type="url"
              disabled={disabled}
              maxLength={AGENT_URL_MAX}
              value={value.url ?? ""}
              aria-invalid={urlError ? true : undefined}
              aria-describedby={urlError ? urlHelp : undefined}
              onChange={(e) => set("url", e.target.value)}
            />
            {urlError && (
              <p id={urlHelp} className="field-help text-red-600">
                {urlError}
              </p>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor={`${uid}-notes`}>
              Why I want this role
            </label>
            <textarea
              id={`${uid}-notes`}
              className="field-control"
              rows={3}
              disabled={disabled}
              maxLength={AGENT_NOTES_MAX}
              value={value.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
