/**
 * Unified document extraction layer.
 *
 * Supports: PDF, DOCX, TXT, and pasted text.
 * All parsing is server-side only (Next.js API routes).
 * Returns clean, normalized text suitable for LLM analysis.
 */

import pdf from "pdf-parse";
import mammoth from "mammoth";
import {
  getFileType,
  isSupportedFile,
  MAX_FILE_SIZE,
  MAX_TEXT_LENGTH,
  type SupportedFileType,
} from "./document-types";

// Re-export client-safe helpers so consumers can import everything from here.
// NOTE: importing from lib/documents.ts pulls pdf-parse/mammoth into the bundle,
// so client components should import from lib/document-types.ts instead.
export { getFileType, isSupportedFile, MAX_FILE_SIZE, MAX_TEXT_LENGTH };
export type { SupportedFileType };

export interface ExtractedDocument {
  text: string;
  fileName: string;
  fileType: SupportedFileType;
  charCount: number;
}

export function validateFileSize(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File must be under ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB.`,
    );
  }
}

export async function extractTextFromDocument(file: File): Promise<ExtractedDocument> {
  validateFileSize(file);

  const fileType = getFileType(file.name);
  if (fileType === "pasted") {
    throw new Error(
      "Unsupported file type. Please upload a PDF, DOCX, or TXT file, or paste text directly.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";

  switch (fileType) {
    case "pdf": {
      const data = await pdf(buffer);
      text = data.text || "";
      break;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || "";
      break;
    }
    case "txt": {
      text = await file.text();
      break;
    }
  }

  // Normalize whitespace: collapse newlines and excessive spaces
  text = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n+/g, "\n").trim();

  if (!text || text.length < 20) {
    throw new Error(
      fileType === "pdf"
        ? "Could not extract readable text from this PDF. It may be a scanned image. Try pasting the text directly."
        : `Could not extract text from this ${fileType.toUpperCase()} file. Try pasting the text directly.`,
    );
  }

  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH);
  }

  return {
    text,
    fileName: file.name,
    fileType,
    charCount: text.length,
  };
}

export async function extractTextFromPasted(text: string): Promise<ExtractedDocument> {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();

  if (!normalized || normalized.length < 5) {
    throw new Error("Please provide more text.");
  }

  if (normalized.length > MAX_TEXT_LENGTH) {
    return {
      text: normalized.slice(0, MAX_TEXT_LENGTH),
      fileName: "pasted-text",
      fileType: "pasted",
      charCount: normalized.length,
    };
  }

  return {
    text: normalized,
    fileName: "pasted-text",
    fileType: "pasted",
    charCount: normalized.length,
  };
}

/**
 * Unified entry point: accepts a File OR a raw text string.
 * Returns the extracted text document or throws with a user-friendly message.
 */
export async function extractDocument(input: File | string): Promise<ExtractedDocument> {
  if (typeof input === "string") {
    return extractTextFromPasted(input);
  }
  return extractTextFromDocument(input);
}
