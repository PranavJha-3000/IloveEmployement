"use client";
import { useRef, useState } from "react";
interface Props { value: string; onChange: (text: string) => void; disabled?: boolean; }
const MAX_SIZE = 5 * 1024 * 1024;
export function ResumeCard({ value, onChange, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(file: File) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".docx") || name.endsWith(".doc")) {
      return setUploadError("DOCX isn't supported yet - export as PDF or paste the text.");
    }
    if (!name.endsWith(".pdf") && !name.endsWith(".txt")) {
      return setUploadError("Only PDF or TXT files are supported. Try pasting text instead.");
    }
    if (file.size > MAX_SIZE) return setUploadError("File must be under 5MB.");
    setUploading(true);
    setUploadError("");
    try {
      if (name.endsWith(".txt")) {
        const text = await file.text();
        onChange(text.slice(0, 20000));
      } else {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/parse-pdf", { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to parse PDF.");
        onChange(json.text);
      }
      setFileName(file.name);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to read file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="field-label">Your Resume</label>
      <div
        onClick={() => !disabled && fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file && !disabled) handleFileSelect(file);
        }}
        className={`resume-dropzone ${disabled ? "opacity-60" : ""}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />
        {uploading ? (
          <p>Extracting text...</p>
        ) : (
          <>
            <span className="upload-mark">&#8593;</span>
            <p>Drag &amp; drop your resume here</p>
            <small>or</small>
            <button type="button" className="upload-button">Choose File</button>
            <small>PDF or TXT, up to 5MB</small>
          </>
        )}
      </div>
      {fileName && !uploading && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-md px-2.5 py-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="text-zinc-400 flex-shrink-0">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-medium truncate">{fileName}</span>
          <span className="text-zinc-400 flex-shrink-0">loaded</span>
        </div>
      )}
      <p className="paste-label">or paste your resume</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste your resume text here..."
        rows={5}
        className="field-control resume-textarea"
      />
      {uploadError && <p className="field-help text-red-600">{uploadError}</p>}
    </div>
  );
}

