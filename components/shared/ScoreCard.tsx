"use client";

interface Props {
  score: number;
  label: string;
  sublabel?: string;
  color?: "red" | "amber" | "emerald" | "blue" | "zinc";
  className?: string;
}

const COLORS: Record<NonNullable<Props["color"]>, string> = {
  red: "text-red-600",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
  blue: "text-blue-600",
  zinc: "text-zinc-600",
};

/**
 * Score display card — a large number with a label.
 * Used for fit scores, ATS scores, rizz scores, etc.
 */
export function ScoreCard({
  score,
  label,
  sublabel,
  color = "red",
  className,
}: Props) {
  return (
    <div className={`bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-center ${className || ""}`}>
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-3xl font-bold ${COLORS[color]}`}>{Math.round(score)}/100</p>
      {sublabel && <p className="text-xs text-zinc-500 mt-1">{sublabel}</p>}
    </div>
  );
}
