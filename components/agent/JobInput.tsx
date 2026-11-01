"use client";

import { useId } from "react";
import { AGENT_JD_MAX, AGENT_NOTES_MAX, AGENT_TEXT_MAX, AGENT_URL_MAX } from "@/lib/agent/config";
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
  const personHelp = `${uid}-person-help`;
  const urlHelp = `${uid}-url-help`;
  const notesHelp = `${uid}-notes-help`;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <label className="field-label" htmlFor={`${uid}-jd`}>
          Job description <span className="text-red-600">*</span>
        </label>
        <textarea
          id={`${uid}-jd`}
          className="field-control"
          rows={6}
          required
          disabled={disabled}
          maxLength={AGENT_JD_MAX}
          value={value.description}
          aria-describedby={jdHelp}
          onChange={(e) => set("description", e.target.value)}
        />
        <p id={jdHelp} className="field-help">
          It&apos;s screened for hidden instructions before the AI reads it.
        </p>
      </div>
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
          aria-describedby={personHelp}
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
          aria-describedby={personHelp}
          onChange={(e) => set("role", e.target.value)}
        />
        <p id={personHelp} className="field-help">
          Used by the cover letter and outreach. Leave blank to get a [Company] or [Role] placeholder.
        </p>
      </div>
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
          aria-describedby={urlHelp}
          onChange={(e) => set("url", e.target.value)}
        />
        <p id={urlHelp} className="field-help">
          Saved with your tailored resume so you can find it later.
        </p>
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
          aria-describedby={notesHelp}
          onChange={(e) => set("notes", e.target.value)}
        />
        <p id={notesHelp} className="field-help">
          Used in the cover letter and outreach. Leave blank to get a [placeholder].
        </p>
      </div>
    </div>
  );
}
