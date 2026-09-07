"use client";
import type { DeluluCheckResult } from "@/lib/types";

interface Props {
  result: DeluluCheckResult;
}

function ListCard({
  title,
  accent,
  items,
  emptyText,
}: {
  title: string;
  accent: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div>
      <h4 className={"text-xs font-bold uppercase tracking-wider " + accent}>{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-400 italic">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-zinc-300 mt-0.5 flex-shrink-0" aria-hidden>
                &ndash;
              </span>
              <p className="text-sm text-zinc-700 leading-relaxed">{item}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RealityCheck({ result }: Props) {
  const rc = result.realityCheck;
  const hasFatal = result.whatIsActuallyFatal.length > 0;

  return (
    <section className="card">
      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
        Reality Check
      </h3>
      <p className="text-xs text-zinc-400 mt-1">
        What the JD asks for vs. what your resume shows.
      </p>

      {/* Side-by-side comparison */}
      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        {rc.experienceRequired && (
          <>
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Experience required
              </p>
              <p className="mt-1 text-sm text-zinc-700 leading-relaxed">{rc.experienceRequired}</p>
            </div>
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Experience you have
              </p>
              <p className="mt-1 text-sm text-zinc-700 leading-relaxed">{rc.experienceYouHave}</p>
            </div>
          </>
        )}
        {rc.coreSkillsRequired && (
          <>
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Core skills required
              </p>
              <p className="mt-1 text-sm text-zinc-700 leading-relaxed">{rc.coreSkillsRequired}</p>
            </div>
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Core skills you demonstrate
              </p>
              <p className="mt-1 text-sm text-zinc-700 leading-relaxed">{rc.coreSkillsYouDemonstrate}</p>
            </div>
          </>
        )}
        {rc.preferredQualifications && (
          <>
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Preferred qualifications
              </p>
              <p className="mt-1 text-sm text-zinc-700 leading-relaxed">{rc.preferredQualifications}</p>
            </div>
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Evidence available
              </p>
              <p className="mt-1 text-sm text-zinc-700 leading-relaxed">{rc.evidenceAvailable}</p>
            </div>
          </>
        )}
      </div>

      {/* Categorized lists */}
      <div className="mt-8 pt-6 border-t border-zinc-100 grid sm:grid-cols-2 gap-8">
        <ListCard
          title="What You Have"
          accent="text-green-700"
          items={result.whatYouHave}
          emptyText="No matching strengths detected."
        />
        <ListCard
          title="What They Want"
          accent="text-blue-700"
          items={result.whatTheyWant}
          emptyText="Nothing specific detected."
        />
        <ListCard
          title="What's Missing"
          accent="text-amber-700"
          items={result.whatsMissing}
          emptyText="No gaps detected."
        />
        <ListCard
          title="What Transfers"
          accent="text-purple-700"
          items={result.whatTransfers}
          emptyText="No transferable experience detected."
        />
      </div>

      <div className="mt-6">
        <ListCard
          title="What Is Actually Fatal"
          accent="text-red-700"
          items={result.whatIsActuallyFatal}
          emptyText="No hard blockers detected. Missing preferred skills are not fatal."
        />
        {hasFatal && (
          <p className="mt-2 text-xs text-zinc-400">
            Missing preferred qualifications are never treated as fatal - only genuine hard blockers appear here.
          </p>
        )}
      </div>
    </section>
  );
}