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

const TOPICS: { value: Topic; label: string; note: string }[] = [
  {
    value: "tool-idea",
    label: "Tool Idea",
    note: "Something we're missing. Cook responsibly.",
  },
  {
    value: "bug",
    label: "Bug Report",
    note: "Tell us what broke. We promise not to blame your browser.",
  },
  {
    value: "feature",
    label: "Feature Request",
    note: "Drop the idea. We might actually build it.",
  },
  {
    value: "career-rant",
    label: "Career Rant",
    note: "Corporate therapy, but free.",
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
      <section className="w-full py-14 px-5">
        <div className="max-w-[880px] mx-auto">
          <div className="bg-white border border-zinc-200 rounded-xl px-8 py-10 text-center">
            <h3 className="text-2xl font-bold text-zinc-900">
              Feedback locked in.
            </h3>
            <p className="mt-3 text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
              Your email draft should be open and ready to send to{" "}
              <span className="font-semibold text-zinc-800">
                {CONTACT_EMAIL}
              </span>
              . If nothing opened, copy your message below and send it manually.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={copyDraft} className="cta-primary">
                {copied ? "Copied" : "Copy my message"}
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
    <section className="w-full py-14 px-5">
      <div className="max-w-[880px] mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-zinc-900">
            Tell us what to build next
          </h2>
          <p className="mt-3 text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
            Got a tool idea, found something broken, or have strong opinions
            about the job hunt? We read it.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-zinc-200 rounded-xl px-8 py-8"
        >
          {/* Feedback type selector */}
          <div className="mb-6">
            <label htmlFor="contactTopic" className="field-label">
              Feedback type
            </label>
            <div
              id="contactTopic"
              className="mt-2 flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Feedback type"
            >
              {TOPICS.map((t) => {
                const selected = topic === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTopic(t.value)}
                    className={
                      selected
                        ? "bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    }
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-400">{topicMeta.note}</p>
          </div>

          {/* Name + Email */}
          <div className="grid sm:grid-cols-2 gap-4 mt-6">
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
