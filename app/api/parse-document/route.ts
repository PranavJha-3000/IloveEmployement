/**
 * Unified document parsing endpoint.
 * Supports PDF, DOCX, and TXT files.
 * Replaces the old parse-pdf-only endpoint.
 */

import { NextResponse, type NextRequest } from "next/server";
import { extractTextFromDocument, isSupportedFile } from "@/lib/documents";

export const maxDuration = 30;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (!isSupportedFile(file.name)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF, DOCX, or TXT file, or paste text directly." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File must be under 5MB." }, { status: 400 });
    }

    const extracted = await extractTextFromDocument(file);

    return NextResponse.json({
      text: extracted.text,
      fileName: extracted.fileName,
      fileType: extracted.fileType,
      charCount: extracted.charCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to parse document.";
    const status = msg.includes("Could not extract") || msg.includes("Unsupported") ? 422 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
