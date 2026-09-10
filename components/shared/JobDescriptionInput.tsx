"use client";
import { useState } from "react";
import { ResumeCard } from "@/components/ResumeCard";

interface Props {
  value: string;
  onChange: (text: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}

/** Shared job description textarea with consistent styling. */
export function JobDescriptionInput({
  value,
  onChange,
  label = "Job Description",
  placeholder = "Paste the job description here...",
  disabled,
  rows = 10,
}: Props) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className="field-control jd-input"
      />
      <p className="field-help">The more detail, the better the analysis.</p>
    </div>
  );
}

/**
 * Shared profile inputs for LinkedIn and GitHub URLs.
 * Optional — tools that don't need them can omit this component.
 */
export function ProfileInputs({
  linkedinUrl,
  setLinkedinUrl,
  githubUrl,
  setGithubUrl,
  disabled,
}: {
  linkedinUrl: string;
  setLinkedinUrl: (v: string) => void;
  githubUrl: string;
  setGithubUrl: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3 mt-3">
      <div>
        <label htmlFor="linkedin" className="field-label">
          LinkedIn <em>(optional)</em>
        </label>
        <input
          id="linkedin"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          disabled={disabled}
          placeholder="linkedin.com/in/you"
          className="field-control"
        />
      </div>
      <div>
        <label htmlFor="github" className="field-label">
          GitHub <em>(optional)</em>
        </label>
        <input
          id="github"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          disabled={disabled}
          placeholder="github.com/you"
          className="field-control"
        />
      </div>
    </div>
  );
}

export { ResumeCard };
