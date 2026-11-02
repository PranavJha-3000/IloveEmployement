// Field builders shared by every preset file.

import type { FieldSpec } from "../engine/types";

export const text = (key: string, label: string, opts: Partial<FieldSpec> = {}): FieldSpec => ({
  key,
  label,
  kind: "text",
  maxLength: 200,
  ...opts,
});

export const area = (key: string, label: string, opts: Partial<FieldSpec> = {}): FieldSpec => ({
  key,
  label,
  kind: "textarea",
  maxLength: 4000,
  ...opts,
});

export const chips = (
  key: string,
  label: string,
  options: [string, string][],
  defaultValue?: string,
  opts: Partial<FieldSpec> = {},
): FieldSpec => ({
  key,
  label,
  kind: "chips",
  options: options.map(([value, label]) => ({ value, label })),
  defaultValue: defaultValue ?? options[0][0],
  ...opts,
});

export const company = (required = true) => text("company", "Company", { required, placeholder: "e.g. Razorpay" });
export const role = (required = true, label = "Role") => text("role", label, { required, placeholder: "e.g. Backend Engineer" });
export const recipient = (label = "Recipient's name") => text("recipientName", label, { placeholder: "Leave blank if unknown" });

export const jobDescription = (required = false) =>
  area("jobDescription", "Job description", {
    required,
    untrusted: true,
    maxLength: 10000,
    placeholder: "Paste the posting. It's screened for hidden instructions before the AI reads it.",
  });

/** Paste/upload box; filled → used as this run's vault context. Empty → the saved vault is used. */
export const resume = (): FieldSpec => ({
  key: "resume",
  label: "Resume",
  kind: "resume",
  maxLength: 20000,
  placeholder: "Paste your resume, or leave empty to use your Career Vault",
});

export const extra = area("extra", "Anything else to include?", { maxLength: 1500, placeholder: "Optional" });

export const tone = chips("tone", "Tone", [
  ["professional", "Professional"],
  ["warm", "Warm"],
  ["direct", "Direct"],
  ["formal", "Formal"],
]);

export const joinQuery = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ");
