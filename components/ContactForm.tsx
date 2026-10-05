"use client";
import { useState } from "react";

type Topic = "tool-idea" | "bug" | "feature" | "career-rant";
type Phase = "idle" | "success";

/**
 * Where feedback drafts are addressed. No backend, no storage — the form just
 * opens the visitor's own email client with everything pre-filled. Swap in the
 * real inbox address here.
 */
const CONTACT_EMAIL = "hello@iloveemployment.app";

// ─── Line icons (24x24, stroke-based, lucide-style — same set as lib/tools.ts) ──
const ICON = {
  lightbulb:
    "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5a6 6 0 0 0-12 0c0 1 .2 2.2 1.5 3.5.8.8 1.3 1.5 1.5 2.5 M9 18h6 M10 21.5h4",
  bug: "M8 2l1.5 3 M16 2l-1.5 3 M9 5h6a4 4 0 0 1 4 4v3a7 7 0 0 1-14 0V9a4 4 0 0 1 4-4z M3 10h2 M19 10h2 M3 15h2.5 M18.5 15H21 M9 21l1-3 M15 21l1-3",
  fileText:
    "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  message:
    "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  lock: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4",
  send: "M22 2 14 22 11 13 2 9z M22 2 11 13",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6 12 13 2 6",
  check: "M20 6L9 17l-5-5",
};

/** Inline stroke icon — mirrors the lucide-style path rendering used in ToolCard. */
function LineIcon({
  d,
  size = 20,
  strokeWidth = 1.8,
  className,
}: {
  d: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

/** Compact reassurance notes shown under the CTA. */
const PROMISES = [
  { icon: ICON.user, text: "No account, no sign-up, no nonsense." },
  { icon: ICON.lock, text: "Nothing is stored and nothing is tracked." },
  { icon: ICON.send, text: "This site never sends or sees your message." },
];

const TOPICS: { value: Topic; label: string; note: string; icon: string }[] = [
  {
    value: "tool-idea",
    label: "Tool Idea",
    note: "Something we're missing. Cook responsibly.",
    icon: ICON.lightbulb,
  },
  {
    value: "bug",
    label: "Bug Report",
    note: "Tell us what broke. We promise not to blame your browser.",
    icon: ICON.bug,
  },
  {
    value: "feature",
    label: "Feature Request",
    note: "Drop the idea. We might actually build it.",
    icon: ICON.fileText,
  },
  {
    value: "career-rant",
    label: "Career Rant",
    note: "Corporate therapy, but free.",
    icon: ICON.message,
  },
];

const TA =
  "w-full bg-white border border-zinc-300 rounded-lg px-3.5 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition disabled:opacity-60";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<Topic>("tool-idea");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [copied, setCopied] = useState(false);

  const topicMeta = TOPICS.find((t) => t.value === topic) ?? TOPICS[0];
  const subject = `[iloveemployment] ${topicMeta.label}${name.trim() ? ` — ${name.trim()}` : ""}`;
  const body = [
    message.trim(),
    "",
    "---",
    `Topic: ${topicMeta.label}`,
    `From: ${name.trim() || "Anonymous"}`,
    email.trim() ? `Reply to: ${email.trim()}` : "No reply address provided",
  ].join("\n");
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!message.trim()) {
      setError("A message is required.");
      return;
    }
    setCopied(false);
    setPhase("success");
    // Opens the visitor's email client with the draft pre-filled. Nothing is sent or stored by the site itself.
    window.location.href = mailto;
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(
        `To: ${CONTACT_EMAIL}\nSubject: ${subject}\n\n${body}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  function reset() {
    setMessage("");
    setError("");
    setPhase("idle");
  }

  if (phase === "success") {
    return (
      <section id="feedback" className="w-full bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-[1280px] rounded-2xl bg-[#FAFAFA] px-5 py-16 sm:px-8 sm:py-20 lg:px-16">
          <div className="mx-auto max-w-[520px] text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <LineIcon d={ICON.check} size={22} strokeWidth={2.4} />
            </span>
            <h3 className="mt-5 text-2xl font-bold tracking-tight text-zinc-900">
              Feedback locked in.
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-500">
              Your email draft should be open and ready to send to{" "}
              <span className="font-semibold text-zinc-800">{CONTACT_EMAIL}</span>
              . If nothing opened, copy the draft and send it yourself.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button onClick={copyDraft} className="cta-primary">
                {copied ? "Copied to clipboard" : "Copy my message"}
              </button>
              <button onClick={reset} className="cta-secondary">
                Write another
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="feedback" className="w-full bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Light-gray feedback panel — the surrounding page stays white. */}
      <div className="mx-auto w-full max-w-[1280px] rounded-2xl bg-[#FAFAFA] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-20 xl:px-16">
        {/* Centered header: eyebrow → heading → supporting copy */}
        <header className="text-center">
          <p className="eyebrow text-center">SUGGESTIONS, BUGS &amp; RANTS</p>
          <h2 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            Tell us what to build next
          </h2>
          <p className="mx-auto mt-4 max-w-[640px] text-[15px] leading-relaxed text-zinc-500 sm:text-base">
            Got a tool idea, found something broken, or just want to vent about
            the job hunt?{" "}
            <span className="text-zinc-400">We read these. Unfortunately.</span>
          </p>
        </header>

        {/* Feedback type cards — one row on desktop, 2×2 on tablet, stacked on mobile */}
        <fieldset className="mx-auto mt-10 max-w-[1140px]">
          <legend className="sr-only">What&apos;s this about?</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {TOPICS.map((t) => {
              const selected = topic === t.value;
              return (
                <label key={t.value} className="relative block cursor-pointer">
                  <input
                    type="radio"
                    name="feedbackTopic"
                    value={t.value}
                    checked={selected}
                    onChange={() => setTopic(t.value)}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex h-full flex-col items-start rounded-xl border p-5 text-left transition sm:p-6 ${
                      selected
                        ? "border-red-500 bg-red-50/70 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                        : "border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-zinc-300 hover:shadow-[0_4px_10px_rgba(16,24,40,0.07)]"
                    } peer-focus-visible:ring-2 peer-focus-visible:ring-red-500/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#FAFAFA]`}
                  >
                    <LineIcon
                      d={t.icon}
                      size={24}
                      strokeWidth={1.8}
                      className={selected ? "text-red-600" : "text-zinc-700"}
                    />
                    <span className="mt-3.5 block text-[15px] font-bold text-zinc-900">
                      {t.label}
                    </span>
                    <span className="mt-1.5 block text-[13px] leading-snug text-zinc-500">
                      {t.note}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Form — centered, capped around 1060px */}
        <form onSubmit={handleSubmit} className="mx-auto mt-9 w-full max-w-[1060px]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contactName" className="field-label">
                Name <em>(optional)</em>
              </label>
              <input
                id="contactName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className={TA}
              />
            </div>
            <div>
              <label htmlFor="contactEmail" className="field-label">
                Email <em>(optional)</em>
              </label>
              <input
                id="contactEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className={TA}
              />
              <p className="field-help">Only if you want a reply.</p>
            </div>
          </div>

          {/* Message */}
          <div className="mt-6">
            <label htmlFor="contactMessage" className="field-label">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="contactMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what to build, what to fix, or how the job hunt is going..."
              rows={6}
              className={TA}
            />
          </div>

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

          {/* Submit */}
          <button type="submit" className="cta-primary w-full mt-6">
            Send Feedback &rarr;
          </button>
          <p className="text-xs text-zinc-400 text-center mt-3">
            Nothing is stored. Nothing is tracked. Your email is only used if
            you ask for a reply.
          </p>
        </form>
      </div>
    </section>
  );
}
