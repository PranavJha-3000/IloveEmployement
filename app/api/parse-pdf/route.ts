import { NextResponse, type NextRequest } from "next/server";
import pdf from "pdf-parse";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "PDF must be under 5MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdf(buffer);

    const text = data.text?.replace(/\s+/g, " ").trim() ?? "";

    if (!text || text.length < 50) {
      return NextResponse.json(
        { error: "Could not extract readable text from this PDF. It may be a scanned image. Try pasting the text directly." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: text.slice(0, 20_000) });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse PDF. Try pasting the text directly instead." },
      { status: 500 }
    );
  }
}
