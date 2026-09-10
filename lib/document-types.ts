/**
 * Client-safe document type helpers.
 *
 * These helpers contain NO server-only imports (no pdf-parse, no mammoth),
 * so they can be imported safely from client components like ResumeCard.
 * The actual text extraction lives in lib/documents.ts (server-side only).
 */

export type SupportedFileType = "pdf" | "docx" | "txt" | "pasted";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_TEXT_LENGTH = 20_000;

export function getFileType(fileName: string): SupportedFileType {
  const name = fileName.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx") || name.endsWith(".doc")) return "docx";
  if (name.endsWith(".txt")) return "txt";
  return "pasted";
}

export function isSupportedFile(fileName: string): boolean {
  return getFileType(fileName) !== "pasted";
}