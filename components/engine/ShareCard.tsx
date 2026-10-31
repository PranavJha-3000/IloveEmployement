"use client";

import { useState } from "react";

interface ShareCardProps {
  tool: string;
  slug: string;
  /** Big number or short verdict on the card. */
  score: string;
  label: string;
  headline: string;
  accent: string;
}

const W = 1200;
const H = 630;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, "")}…`;
  return lines;
}

/** Draws the result as a 1200×630 image (the Open Graph size) entirely in the browser. */
function render({ tool, slug, score, label, headline, accent }: ShareCardProps): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = (weight: number, size: number) => `${weight} ${size}px Inter, "Segoe UI", Arial, sans-serif`;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 14);

  ctx.font = font(800, 34);
  ctx.fillStyle = "#e31e24";
  ctx.fillText("ilove", 70, 96);
  const iloveW = ctx.measureText("ilove").width;
  ctx.fillStyle = "#111827";
  ctx.fillText("employment", 70 + iloveW, 96);

  ctx.font = font(600, 28);
  ctx.fillStyle = "#667085";
  ctx.fillText(tool.toUpperCase(), 70, 170);

  ctx.font = font(800, score.length > 6 ? 96 : 150);
  ctx.fillStyle = accent;
  ctx.fillText(score, 66, 330);

  ctx.font = font(700, 44);
  ctx.fillStyle = "#111827";
  wrap(ctx, label, W - 140, 1).forEach((l) => ctx.fillText(l, 70, 405));

  ctx.font = font(400, 32);
  ctx.fillStyle = "#344054";
  wrap(ctx, headline, W - 140, 3).forEach((l, i) => ctx.fillText(l, 70, 465 + i * 44));

  ctx.font = font(500, 24);
  ctx.fillStyle = "#98a2b3";
  ctx.fillText(`iloveemployement.vercel.app/tools/${slug}`, 70, H - 40);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function ShareCard(props: ShareCardProps) {
  const [status, setStatus] = useState("");
  const text = `${props.tool}: ${props.score} · ${props.label}. ${props.headline} — iloveemployement.vercel.app/tools/${props.slug}`;

  async function share() {
    const blob = await render(props);
    if (!blob) return setStatus("Couldn't draw the image.");
    const file = new File([blob], `${props.slug}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch {
        // Cancelled: fall through to download.
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Image downloaded.");
  }

  async function copy() {
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setStatus("Copied.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void share()} className="rounded-md bg-zinc-900 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-zinc-700">
        Share result image
      </button>
      <button type="button" onClick={() => void copy()} className="rounded-md border border-zinc-200 px-3 py-1.5 text-[12px] font-semibold text-zinc-600 hover:border-zinc-300">
        Copy text
      </button>
      {status && <span className="text-[11.5px] text-zinc-500">{status}</span>}
    </div>
  );
}
