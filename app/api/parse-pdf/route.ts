/**
 * Legacy parse-pdf endpoint — delegates to the unified parse-document endpoint.
 * Kept for backward compatibility; new code should use /api/parse-document.
 */
import { NextResponse, type NextRequest } from "next/server";
import { extractTextFromDocument } from "@/lib/documents";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported by this endpoint." }, { status: 400 });
    }

    const extracted = await extractTextFromDocument(file);
    return NextResponse.json({ text: extracted.text });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse PDF. Try pasting the text directly instead." },
      { status: 500 },
    );
  }
}
