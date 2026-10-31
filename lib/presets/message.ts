// ─── Message Engine Presets ──────────────────────────────────────────────────
// Every email, DM, letter, script and short document the platform writes.
// A preset is configuration: fields to collect, knowledge to retrieve, what to
// pull from the vault, and the instruction. The engine does the rest.
// The user's field values are passed to the model separately, so task() only
// states what to write and how — it never needs to repeat the inputs.

import { area, chips, company, extra, jobDescription, joinQuery, recipient, role, text, tone } from "./fields";
import type { MessagePreset } from "./types";

// ─── Presets ─────────────────────────────────────────────────────────────────

export const MESSAGE_PRESETS: MessagePreset[] = [
  // OUTREACH ──────────────────────────────────────────────────────────────────
  {
    id: "cold-recruiter-message",
    slug: "cold-recruiter-message",
    engine: "message",
    category: "outreach",
    name: "Cold Recruiter Message",
    tagline: "A cold message that gets replies, not left on read.",
    description:
      "Write a short, specific cold message to a recruiter or hiring manager, built from your real experience and the role's top requirement.",
    icon: "messages",
    fields: [
      chips("channel", "Where are you sending it?", [
        ["linkedin-note", "LinkedIn connection note"],
        ["linkedin-message", "LinkedIn message"],
        ["email", "Email"],
      ]),
      company(),
      role(),
      recipient(),
      chips("recipientRole", "They are a…", [
        ["recruiter", "Recruiter"],
        ["hiring-manager", "Hiring manager"],
        ["team-member", "Engineer / team member"],
      ]),
      jobDescription(),
      area("hook", "Why this company, specifically?", { maxLength: 600, placeholder: "Optional: a product you use, a talk you saw, a team you admire" }),
      tone,
    ],
    kbTags: ["outreach", "recruiter", "email"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.role, i.company, i.jobDescription?.slice(0, 1500)),
    format: (i) => (i.channel === "email" ? "email" : "dm"),
    task: (i) =>
      `Write a cold outreach message to a ${i.recipientRole || "recruiter"} about the role.` +
      (i.channel === "linkedin-note"
        ? " It is a LinkedIn connection note: the body MUST be under 300 characters including spaces."
        : " Keep it roughly 75–125 words.") +
      " Pick the one or two vault facts that best match the role's most important requirement. End with a single low-friction ask. Provide one variant with a different hook.",
  },
  {
    id: "referral-request",
    slug: "referral-request",
    engine: "message",
    category: "outreach",
    name: "Referral Request",
    tagline: "Ask for a referral without making it awkward.",
    description:
      "Ask a contact to refer you, with a paste-ready fit summary they can drop into the referral form and an easy way to say no.",
    icon: "userCircle",
    fields: [
      chips("relationship", "How do you know them?", [
        ["former-colleague", "Former colleague"],
        ["alumni", "Alumni"],
        ["friend", "Friend"],
        ["acquaintance", "Acquaintance"],
        ["never-met", "Never met"],
      ]),
      recipient("Their name"),
      company(),
      role(),
      text("jobLink", "Job link or ID", { maxLength: 400, placeholder: "Optional" }),
      jobDescription(),
      extra,
    ],
    kbTags: ["referral", "outreach", "networking"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.role, i.company, i.jobDescription?.slice(0, 1500)),
    format: "dm",
    task: (i) =>
      `Write a referral request to someone who is a ${i.relationship?.replace("-", " ") || "contact"}.` +
      (i.relationship === "never-met" || i.relationship === "acquaintance"
        ? " Because the tie is weak, lead with a lighter ask (advice or a quick chat) and make declining easy."
        : "") +
      " Include a two-line fit summary in quotes that they can paste into a referral form. Offer to send the resume. Provide one shorter variant.",
  },
  {
    id: "application-follow-up",
    slug: "follow-up-email",
    engine: "message",
    category: "outreach",
    name: "Follow-up Email",
    tagline: "Nudge a quiet recruiter, or close the loop after being ghosted.",
    description:
      "Follow up after applying or interviewing, at the right time and with one clear question. It handles being ghosted too, without guilt-tripping.",
    icon: "mail",
    fields: [
      chips("stage", "Where are you?", [
        ["applied", "Applied, no reply"],
        ["post-interview", "Interviewed, waiting"],
        ["post-final", "Finished final round"],
        ["ghosted", "Followed up already, still silence"],
      ]),
      company(),
      role(),
      recipient(),
      text("lastContact", "When did you last hear from them?", { placeholder: "e.g. interview on 14 Oct, they said 'end of next week'" }),
      extra,
    ],
    kbTags: ["follow-up", "ghosted", "outreach", "email"],
    usesVault: false,
    vaultQuery: (i) => joinQuery(i.role, i.company),
    format: "email",
    task: (i) =>
      i.stage === "ghosted"
        ? "Write a final, polite close-the-loop follow-up: restate the role, ask one clear question about status, and offer them an easy way to say the role is filled. No guilt, no sarcasm."
        : "Write a brief follow-up that restates the role and timing, adds one line of genuine value or continued interest, and asks a single clear question about next steps or timeline. Add a note on when to send it, based on the timing the user gave.",
  },
  {
    id: "thank-you-note",
    slug: "interview-thank-you-note",
    engine: "message",
    category: "outreach",
    name: "Interview Thank-You Note",
    tagline: "A thank-you note that couldn't have been sent by anyone else.",
    description:
      "Send a specific thank-you within 24 hours that references your actual conversation and reinforces the strength they cared about.",
    icon: "star",
    fields: [
      company(),
      role(),
      recipient("Interviewer's name"),
      text("interviewerRole", "Their role", { placeholder: "e.g. Engineering Manager" }),
      area("discussed", "What did you talk about?", { required: true, maxLength: 2000, placeholder: "Topics, questions, anything that clicked" }),
      area("addToAnswer", "An answer you'd like to strengthen?", { maxLength: 1000, placeholder: "Optional" }),
    ],
    kbTags: ["thank-you", "interview", "email"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.role, i.discussed, i.addToAnswer),
    format: "email",
    task: () =>
      "Write a thank-you email under about 150 words. Reference one specific thing from the conversation, reinforce one relevant strength using a vault fact, and if the user gave an answer to strengthen, add one or two crisp sentences on it.",
  },
  {
    id: "rejection-reply",
    slug: "rejection-reply",
    engine: "message",
    category: "outreach",
    name: "Rejection Reply",
    tagline: "Get rejected gracefully and keep the door open.",
    description: "Reply to a rejection in a way that leaves a good last impression and keeps you in their pipeline for future roles.",
    icon: "shieldAlert",
    fields: [
      company(),
      role(),
      recipient(),
      area("rejectionEmail", "Their rejection email", { untrusted: true, maxLength: 3000, placeholder: "Optional: paste it for context" }),
      chips("askFeedback", "Ask for feedback?", [
        ["yes", "Yes, politely"],
        ["no", "No"],
      ]),
    ],
    kbTags: ["rejection", "outreach", "email"],
    usesVault: false,
    vaultQuery: (i) => joinQuery(i.role, i.company),
    format: "email",
    task: (i) =>
      `Write a short, gracious reply to the rejection that asks to be considered for future roles.${i.askFeedback === "yes" ? " Include an optional, specific feedback request that's easy to decline." : " Don't ask for feedback."}`,
  },

  // INTERVIEW ─────────────────────────────────────────────────────────────────
  {
    id: "salary-expectation-script",
    slug: "salary-expectations-answer",
    engine: "message",
    category: "interview",
    name: "Salary Expectations Answer",
    tagline: "Know exactly what to say when they ask for a number.",
    description:
      "Get a word-for-word answer to “what are your salary expectations?” for the stage you're at, with a version that deflects and one that gives a range.",
    icon: "scale",
    fields: [
      role(),
      company(false),
      text("location", "Location", { required: true, placeholder: "e.g. Bengaluru, or Remote (US)" }),
      text("range", "Your researched target range", { placeholder: "e.g. ₹28–34 LPA fixed, or $140–160k base" }),
      text("current", "Current compensation", { placeholder: "Optional" }),
      chips("stage", "When are they asking?", [
        ["screen", "Recruiter screen"],
        ["form", "Application form"],
        ["late", "Final rounds / offer stage"],
      ]),
    ],
    kbTags: ["salary-expectations", "salary", "offer"],
    usesVault: false,
    vaultQuery: (i) => joinQuery(i.role),
    format: "script",
    task: (i) =>
      `Write what the user should say out loud${i.stage === "form" ? " (or type into the form field)" : ""} when asked for salary expectations. The body is the recommended answer. Give two variants: one that politely deflects and asks for their budgeted range, and one that states a range. Use only the numbers the user gave; if no range was given, use a [placeholder] and add a note on how to research one. Clarify fixed vs total compensation where relevant.`,
  },

  // OFFER ─────────────────────────────────────────────────────────────────────
  {
    id: "negotiate-offer",
    slug: "salary-negotiation-email",
    engine: "message",
    category: "offer",
    name: "Salary Negotiation",
    tagline: "Counter the offer with a reason, not a vibe.",
    description:
      "Turn your offer, your target and your real leverage into a counteroffer email or call script that negotiates total compensation and doesn't sound greedy.",
    icon: "gauge",
    fields: [
      company(),
      role(),
      recipient("Recruiter's name"),
      area("offer", "The offer as you received it", { required: true, maxLength: 2000, placeholder: "Base, bonus, equity, joining bonus, start date…" }),
      area("target", "What you want", { required: true, maxLength: 800, placeholder: "e.g. ₹36 LPA fixed, or a ₹3L joining bonus if the base is capped" }),
      area("leverage", "Your real leverage", { maxLength: 1500, placeholder: "Competing offers, market data, scope of the role. Only true things." }),
      chips("channel", "Format", [
        ["email", "Email"],
        ["call", "Call script"],
      ]),
    ],
    kbTags: ["negotiation", "offer", "salary"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.role, "impact results leadership scope"),
    format: (i) => (i.channel === "call" ? "script" : "email"),
    task: (i) =>
      (i.channel === "call"
        ? "Write a call script: opening line, the ask with its reason, responses to 'that's our best offer' and 'we can't move on base', and a close."
        : "Write a counteroffer email that opens with enthusiasm, makes one specific, reasoned request, and offers alternatives if base is capped.") +
      " Use only the leverage the user provided — never invent a competing offer or market figure. Add notes on what to do if they say no.",
  },
  {
    id: "accept-offer",
    slug: "accept-job-offer-email",
    engine: "message",
    category: "offer",
    name: "Accept an Offer",
    tagline: "Say yes and lock in the terms in writing.",
    description: "Accept a job offer warmly while confirming title, compensation, start date and next steps in writing.",
    icon: "listChecks",
    fields: [
      company(),
      role(),
      recipient(),
      area("terms", "Key terms to confirm", { required: true, maxLength: 1500, placeholder: "Title, fixed + variable pay, start date, location, manager" }),
      area("questions", "Questions before day one", { maxLength: 800, placeholder: "Optional" }),
    ],
    kbTags: ["accept", "offer"],
    usesVault: false,
    vaultQuery: (i) => joinQuery(i.role),
    format: "email",
    task: () => "Write a warm acceptance email that restates each key term as a list for written confirmation and asks the user's questions about next steps.",
  },
  {
    id: "decline-offer",
    slug: "decline-job-offer-email",
    engine: "message",
    category: "offer",
    name: "Decline an Offer",
    tagline: "Turn down an offer without burning the bridge.",
    description: "Decline a job offer promptly and graciously, with an optional reason and a clear path to stay in touch.",
    icon: "penLine",
    fields: [
      company(),
      role(),
      recipient(),
      chips("reason", "Reason", [
        ["other-offer", "Accepted another offer"],
        ["compensation", "Compensation"],
        ["fit", "Role fit"],
        ["personal", "Personal reasons"],
        ["none", "Prefer not to say"],
      ]),
      chips("openToCounter", "Would a better offer change your mind?", [
        ["no", "No"],
        ["yes", "Yes"],
      ]),
      extra,
    ],
    kbTags: ["decline", "offer"],
    usesVault: false,
    vaultQuery: (i) => joinQuery(i.role),
    format: "email",
    task: (i) =>
      i.openToCounter === "yes"
        ? "The user would accept a better offer, so don't write a flat decline. Write a gracious email saying they can't accept the current terms, naming what would change their decision (use a [placeholder] if they gave no number)."
        : "Write a brief, gracious decline. Give at most a one-line reason (or none if they prefer not to say), thank the team, and keep the door open.",
  },

  // TRANSITION ────────────────────────────────────────────────────────────────
  {
    id: "resignation-letter",
    slug: "resignation-letter",
    engine: "message",
    category: "transition",
    name: "Resignation Letter",
    tagline: "Quit cleanly. Comes with a rage filter.",
    description:
      "Write a professional resignation letter with your last day and a transition plan, or paste the furious version you'd like to send and get a sendable one back.",
    icon: "penLine",
    fields: [
      chips("mode", "Start from", [
        ["fresh", "Write it for me"],
        ["rage", "Clean up my angry draft"],
      ]),
      recipient("Manager's name"),
      company(false),
      role(true, "Your role"),
      text("lastDay", "Last working day or notice period", { required: true, placeholder: "e.g. 30 days from today, or 15 Dec 2026" }),
      area("transition", "Transition you can offer", { maxLength: 1200, placeholder: "Handover doc, finishing a project, training someone" }),
      area("draft", "Your draft (the honest version)", { maxLength: 4000, placeholder: "Only for 'clean up my angry draft'. Vent freely; none of it gets sent." }),
      tone,
    ],
    kbTags: ["resignation", "transition"],
    usesVault: false,
    vaultQuery: (i) => joinQuery(i.role),
    format: "letter",
    task: (i) =>
      (i.mode === "rage"
        ? "The user's draft contains their honest feelings. Write a professional resignation letter that keeps only what belongs in writing; drop grievances and emotional content entirely. In notes, briefly say what was removed and suggest where (if anywhere) that feedback could be raised constructively."
        : "Write a resignation letter.") +
      " State the resignation, role and last working day. Offer a concrete transition plan. Thank them briefly. Mention relieving/experience letters only if appropriate to the user's context.",
  },
  {
    id: "notice-period-request",
    slug: "notice-period-early-release",
    engine: "message",
    category: "transition",
    name: "Notice Period & Joining Date",
    tagline: "Negotiate an early release or a later start date.",
    description:
      "Ask your current employer for an early release or buyout, or ask your new employer for a later joining date, with a specific date and a credible plan.",
    icon: "clipboardList",
    fields: [
      chips("ask", "What do you need?", [
        ["early-release", "Early release (current employer)"],
        ["buyout", "Notice buyout (current employer)"],
        ["later-joining", "Later joining date (new employer)"],
      ]),
      recipient(),
      company(false),
      text("notice", "Notice period", { required: true, placeholder: "e.g. 90 days, serving since 1 Oct" }),
      text("proposedDate", "Date you're proposing", { required: true, placeholder: "e.g. last day 15 Nov / join on 2 Dec" }),
      area("reason", "Reason", { maxLength: 800, placeholder: "Brief and honest" }),
      area("handover", "Handover plan", { maxLength: 1200, placeholder: "For early release: how your work will be covered" }),
    ],
    kbTags: ["notice-period", "joining", "india", "transition"],
    usesVault: false,
    vaultQuery: (i) => joinQuery(i.ask),
    format: "email",
    task: (i) =>
      i.ask === "later-joining"
        ? "Write to the new employer asking to move the joining date to the proposed date: brief honest reason, reaffirmed commitment, an offer to reduce their risk, and a request to confirm the revised date in writing."
        : `Write to the current manager/HR requesting ${i.ask === "buyout" ? "to buy out the remaining notice period" : "an early release"} with a specific last day, a credible handover plan, and a request to confirm the relieving date in writing.`,
  },
  {
    id: "reference-request",
    slug: "reference-request",
    engine: "message",
    category: "transition",
    name: "Reference Request",
    tagline: "Line up a reference who knows exactly what to say.",
    description: "Ask someone to be your reference, giving them an easy out, the context, and the specific examples you'd like them to mention.",
    icon: "userCircle",
    fields: [
      recipient("Reference's name"),
      text("relationship", "How you worked together", { required: true, placeholder: "e.g. my manager at Zeta, 2022–2024" }),
      company(),
      role(true, "Role you're applying for"),
      area("talkingPoints", "What they could speak to", { maxLength: 1500, placeholder: "Projects, strengths, results they saw" }),
      text("timeline", "When might they be contacted?", { placeholder: "e.g. this week" }),
    ],
    kbTags: ["references", "transition"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.relationship, i.talkingPoints, i.role),
    format: "email",
    task: () =>
      "Write a reference request: ask permission with an easy out, give the role, company and timeline, and list two or three concrete examples (from vault facts and the user's talking points) they could mention.",
  },
  {
    id: "internship-conversion",
    slug: "internship-to-full-time-request",
    engine: "message",
    category: "transition",
    name: "Internship Conversion Ask",
    tagline: "Turn the internship into a full-time offer.",
    description: "Ask your manager for a full-time conversion, backed by what you shipped and the feedback you've had.",
    icon: "target",
    fields: [
      recipient("Manager's name"),
      company(),
      text("team", "Team", { placeholder: "Optional" }),
      text("endDate", "Internship end date", { placeholder: "e.g. 20 Dec" }),
      area("wins", "What you shipped and the feedback you got", { maxLength: 2000 }),
      extra,
    ],
    kbTags: ["internship", "transition", "growth"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.team, i.wins, "intern project shipped impact"),
    format: "email",
    task: () =>
      "Write a message asking for a meeting about full-time conversion. Summarise two or three wins with evidence, state clearly that the user wants a full-time offer, and ask about the process, timeline and what they'd need to show.",
  },
  {
    id: "gap-explainer",
    slug: "employment-gap-explanation",
    engine: "message",
    category: "transition",
    name: "Gap & Layoff Explainer",
    tagline: "Explain a gap or layoff in two honest sentences.",
    description:
      "Explain an employment gap or layoff briefly and honestly for an interview, cover letter, LinkedIn or recruiter email, then pivot to why you're ready now.",
    icon: "gap",
    fields: [
      chips("reason", "Reason", [
        ["layoff", "Laid off"],
        ["health", "Health"],
        ["caregiving", "Caregiving"],
        ["study", "Study / upskilling"],
        ["relocation", "Relocation"],
        ["break", "Deliberate break"],
        ["search", "Job search took a while"],
      ]),
      text("period", "Gap period", { required: true, placeholder: "e.g. Mar–Sep 2026" }),
      area("whatYouDid", "What you did during it", { maxLength: 1500, placeholder: "Courses, projects, freelance, family. Anything true." }),
      text("targetRole", "Role you're targeting", { placeholder: "Optional" }),
      chips("useIn", "Where will you use it?", [
        ["interview", "Interview answer"],
        ["cover-letter", "Cover letter line"],
        ["linkedin", "LinkedIn"],
        ["email", "Recruiter email"],
      ]),
    ],
    kbTags: ["gap", "layoff", "transition", "interview"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.whatYouDid, i.targetRole, "project course certification"),
    format: (i) => (i.useIn === "interview" ? "script" : i.useIn === "email" ? "email" : "doc"),
    task: (i) =>
      `Write a ${i.useIn === "interview" ? "spoken interview answer (20–30 seconds)" : i.useIn === "cover-letter" ? "one or two cover-letter sentences" : i.useIn === "linkedin" ? "short LinkedIn note" : "short recruiter email paragraph"} explaining the gap. State the reason briefly and without apology, then pivot to what the user did and why they're ready now. Never disguise the gap or add detail the user didn't give. Provide one variant for a follow-up question.`,
  },

  // AT WORK ───────────────────────────────────────────────────────────────────
  {
    id: "email-tone-fixer",
    slug: "email-tone-fixer",
    engine: "message",
    category: "work",
    name: "Email Tone Fixer",
    tagline: "Say the same thing without sounding passive-aggressive.",
    description:
      "Paste a draft and fix its tone: less passive-aggressive, firmer, warmer, shorter, or recovering gracefully from a late reply. Your meaning stays the same.",
    icon: "languages",
    fields: [
      area("draft", "Your draft", { required: true, maxLength: 5000 }),
      chips("goal", "Make it…", [
        ["calm", "Less passive-aggressive"],
        ["firmer", "Firmer"],
        ["warmer", "Warmer"],
        ["concise", "Shorter"],
        ["formal", "More formal"],
        ["late-reply", "Recover from a late reply"],
      ]),
      chips("audience", "Sending to", [
        ["manager", "Manager"],
        ["peer", "Peer"],
        ["report", "Direct report"],
        ["client", "Client"],
        ["exec", "Senior leader"],
      ], "peer"),
      area("context", "Context", { maxLength: 1000, placeholder: "Optional: what happened" }),
    ],
    kbTags: ["tone", "work", "email"],
    usesVault: false,
    vaultQuery: () => "",
    format: "email",
    task: (i) =>
      `Rewrite the user's draft so it is ${i.goal === "late-reply" ? "a graceful reply after a delay (one brief acknowledgement, then straight to substance)" : i.goal === "calm" ? "free of passive-aggressive phrasing, neutral and clear" : i.goal}. Keep the meaning and every commitment exactly as the user had them, and add none. Put the most important line first. Leave the subject empty unless the draft had one. In notes, list the specific phrases you changed and why.`,
  },
  {
    id: "leave-request",
    slug: "leave-application",
    engine: "message",
    category: "work",
    name: "Leave Application",
    tagline: "Ask for time off with a coverage plan already sorted.",
    description: "Write a leave or time-off request with exact dates, a coverage plan and how reachable you'll be, for any kind of leave.",
    icon: "clipboardList",
    fields: [
      chips("leaveType", "Type of leave", [
        ["vacation", "Vacation"],
        ["sick", "Sick"],
        ["personal", "Personal"],
        ["bereavement", "Bereavement"],
        ["parental", "Parental"],
        ["wfh", "Work from home"],
      ]),
      text("dates", "Dates", { required: true, placeholder: "e.g. 18–22 Nov (5 working days)" }),
      recipient("Manager's name"),
      area("coverage", "Coverage plan", { maxLength: 1200, placeholder: "Who covers what, status of open work" }),
      chips("reachable", "Reachable while away?", [
        ["no", "No"],
        ["urgent", "Urgent only"],
        ["yes", "Yes"],
      ]),
      text("reason", "Reason (optional)", { maxLength: 300 }),
    ],
    kbTags: ["leave", "work"],
    usesVault: false,
    vaultQuery: () => "",
    format: "email",
    task: (i) =>
      `Write a ${i.leaveType} leave request with the exact dates, a coverage plan (use [placeholders] where the user left gaps) and reachability.${i.leaveType === "sick" || i.leaveType === "bereavement" ? " Keep the reason minimal; no medical or personal detail is needed." : ""} Add a note to also log it in the HR system if the company has one.`,
  },
  {
    id: "corporate-speak-translator",
    slug: "corporate-speak-translator",
    engine: "message",
    category: "work",
    name: "Corporate Speak Translator",
    tagline: "Decode corporate jargon, or make your bluntness professional.",
    description:
      "Translate corporate jargon into plain English with what it probably means, or translate what you really think into something you can say at work.",
    icon: "languages",
    fields: [
      chips("direction", "Translate", [
        ["decode", "Corporate → plain English"],
        ["encode", "What I mean → professional"],
      ]),
      area("text", "Text", { required: true, maxLength: 5000, untrusted: true }),
    ],
    kbTags: ["jargon", "work"],
    usesVault: false,
    vaultQuery: () => "",
    format: "doc",
    task: (i) =>
      i.direction === "decode"
        ? "Translate the text into plain English in the body. In notes, list the most loaded phrases with what they usually signal and how confident that reading is. Leave the subject empty and give no variants."
        : "Rewrite the user's blunt text into professional language that keeps every point. Give one more-diplomatic variant. Leave the subject empty.",
  },
  {
    id: "hr-concern-writeup",
    slug: "hr-complaint-letter",
    engine: "message",
    category: "work",
    name: "HR Concern Write-up",
    tagline: "Report a workplace issue with facts HR can act on.",
    description:
      "Turn what happened into a clear, factual, chronological write-up for HR, with the impact on your work and the outcome you're asking for.",
    icon: "shieldAlert",
    fields: [
      area("what", "What happened", { required: true, maxLength: 5000, placeholder: "In your own words. Include what was said or done." }),
      text("dates", "Dates and places", { maxLength: 400 }),
      text("people", "People involved and witnesses", { maxLength: 400 }),
      area("impact", "Impact on you or your work", { maxLength: 1500 }),
      area("outcome", "The outcome you want", { maxLength: 800 }),
    ],
    kbTags: ["hr", "work"],
    usesVault: false,
    vaultQuery: () => "",
    format: "letter",
    task: () =>
      "Write a factual write-up for HR: a chronological account (dates, people, what was said or done), impact, the requested outcome, and a request for acknowledgement and next steps. Describe behaviour, not legal conclusions. Use [placeholders] for missing dates or names. Add notes reminding the user to keep copies, send it through the official channel, and consider an employment lawyer or labour authority for serious matters.",
  },
  {
    id: "new-joiner-intro",
    slug: "new-job-introduction-message",
    engine: "message",
    category: "work",
    name: "New Job Intro Message",
    tagline: "Introduce yourself in the new team channel.",
    description: "Write a short, human intro for your first week: your team channel, a skip-level, a cross-functional peer or a client.",
    icon: "messages",
    fields: [
      chips("audience", "Who's it for?", [
        ["team", "Team channel"],
        ["skip", "Skip-level manager"],
        ["peer", "Cross-functional peer"],
        ["client", "Client"],
      ]),
      role(true, "Your new role"),
      text("team", "Team", { placeholder: "Optional" }),
      text("human", "One human detail", { maxLength: 200, placeholder: "e.g. I make terrible coffee and great pasta" }),
      text("ask", "Anything you'd like from them?", { maxLength: 300, placeholder: "e.g. 20 minutes to learn how your team uses Looker" }),
    ],
    kbTags: ["onboarding", "work"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.role, i.team, "summary background"),
    format: (i) => (i.audience === "team" ? "dm" : "email"),
    task: () => "Write a short intro: who they are, the role, one line of relevant background from the vault, the human detail, and the ask if there is one. Give one even shorter variant.",
  },
  {
    id: "one-on-one-agenda",
    slug: "one-on-one-meeting-agenda",
    engine: "message",
    category: "work",
    name: "1:1 Agenda Builder",
    tagline: "Walk into your 1:1 with a real agenda.",
    description: "Build a focused one-on-one agenda: priorities, blockers, decisions you need, feedback and career, in the right order.",
    icon: "listChecks",
    fields: [
      chips("with", "1:1 with", [
        ["manager", "My manager"],
        ["report", "My report"],
        ["skip", "Skip-level"],
      ]),
      area("priorities", "Current priorities and progress", { maxLength: 1500 }),
      area("blockers", "Blockers / decisions needed", { maxLength: 1000 }),
      area("feedback", "Feedback to give or ask for", { maxLength: 800 }),
      text("career", "Career topic", { maxLength: 300, placeholder: "Optional, e.g. path to senior" }),
    ],
    kbTags: ["onboarding", "work", "review"],
    usesVault: false,
    vaultQuery: () => "",
    format: "doc",
    task: () =>
      "Write a concise 1:1 agenda as a bulleted list, most important item first, with a suggested time for each section and one specific question per section. Leave the subject empty. No variants.",
  },
  {
    id: "thirty-sixty-ninety-plan",
    slug: "30-60-90-day-plan",
    engine: "message",
    category: "work",
    name: "30-60-90 Day Plan",
    tagline: "A first-90-days plan your new manager will actually like.",
    description: "Build a 30-60-90 day plan for a new role (learn, contribute, own) with measurable goals tailored to the team and job description.",
    icon: "target",
    fields: [
      role(),
      company(false),
      area("context", "What you know about the team and its goals", { maxLength: 2000 }),
      jobDescription(),
      area("expectations", "What your manager has said they need", { maxLength: 1200, placeholder: "Optional" }),
    ],
    kbTags: ["onboarding", "work"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.role, i.context, i.jobDescription?.slice(0, 1000)),
    format: "doc",
    task: () =>
      "Write a 30-60-90 day plan with three sections (Learn / Contribute / Own). Each has 3–5 specific goals, with how success is measured and any dependencies. Use the user's vault strengths to suggest where they can contribute early. Leave the subject empty. No variants.",
  },
  {
    id: "manager-update",
    slug: "weekly-status-update",
    engine: "message",
    category: "work",
    name: "Status Update to Manager",
    tagline: "A weekly update that makes your work visible.",
    description: "Turn scattered notes into a crisp weekly update: wins, progress, risks and what you need, with the important part first.",
    icon: "mail",
    fields: [
      area("notes", "Your notes for the week", { required: true, maxLength: 3000, placeholder: "Messy is fine" }),
      area("asks", "What you need from them", { maxLength: 800 }),
      chips("length", "Length", [
        ["short", "Skimmable"],
        ["detailed", "Detailed"],
      ]),
    ],
    kbTags: ["work", "email"],
    usesVault: false,
    vaultQuery: () => "",
    format: "email",
    task: (i) =>
      `Write a ${i.length === "detailed" ? "detailed" : "skimmable"} weekly status update with sections: Highlights, In progress, Risks/blockers, Asks. Lead with the line the manager most needs. Don't inflate anything; use only the user's notes.`,
  },

  // GROWTH ────────────────────────────────────────────────────────────────────
  {
    id: "self-review-writer",
    slug: "self-review-writer",
    engine: "message",
    category: "growth",
    name: "Self-Review Writer",
    tagline: "Write the self-review that gets you calibrated up.",
    description: "Turn your wins into an impact-first self-review mapped to your level, with evidence from your Career Vault.",
    icon: "star",
    fields: [
      text("period", "Review period", { required: true, placeholder: "e.g. H1 2026" }),
      text("level", "Your level / role", { placeholder: "e.g. SDE-2" }),
      area("questions", "The review questions", { maxLength: 2000, placeholder: "Paste your company's form questions, or leave blank for a standard structure" }),
      area("wins", "Wins this period", { maxLength: 3000, placeholder: "Anything not already in your vault" }),
      text("growthArea", "One honest growth area", { maxLength: 300 }),
    ],
    kbTags: ["review", "growth"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.wins, i.level, "impact result shipped led improved"),
    format: "doc",
    task: () =>
      "Write a self-review organised by impact. Answer the company's questions in order if given; otherwise use Impact, How I worked, Growth area, Next period goals. Use only real wins from the inputs and vault, with metrics only where the user supplied them. Leave the subject empty. No variants.",
  },
  {
    id: "promotion-case",
    slug: "promotion-case-builder",
    engine: "message",
    category: "growth",
    name: "Promotion Case",
    tagline: "Show you're already operating at the next level.",
    description: "Build a promotion case that maps your evidence to the next level's expectations, ready to share with your manager before calibration.",
    icon: "gauge",
    fields: [
      text("currentLevel", "Current level", { required: true }),
      text("targetLevel", "Target level", { required: true }),
      area("expectations", "Next-level expectations", { maxLength: 3000, placeholder: "Paste the career-ladder description if you have it" }),
      area("evidence", "Evidence not in your vault", { maxLength: 3000 }),
      recipient("Manager's name"),
    ],
    kbTags: ["promotion", "review", "growth"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.targetLevel, i.expectations?.slice(0, 1000), i.evidence, "led owned impact mentored"),
    format: "doc",
    task: () =>
      "Write a promotion case: a two-sentence summary, then each next-level expectation with the user's matching evidence (cite vault facts). Mark expectations with weak or no evidence honestly as gaps with a plan. Add a short cover email to the manager as the variant. Leave the subject empty.",
  },
  {
    id: "raise-request",
    slug: "ask-for-a-raise",
    engine: "message",
    category: "growth",
    name: "Ask for a Raise",
    tagline: "Make the case for more money with evidence.",
    description: "Ask for a raise based on value delivered and expanded scope, with a specific number and a plan if the answer is no.",
    icon: "scale",
    fields: [
      recipient("Manager's name"),
      text("ask", "What you're asking for", { required: true, placeholder: "e.g. 15% or ₹6L" }),
      area("value", "Value delivered and scope added", { maxLength: 2500 }),
      area("market", "Market data you have", { maxLength: 1000, placeholder: "Optional. Only real sources." }),
      chips("format", "Format", [
        ["meeting", "Request a meeting"],
        ["written", "Written case"],
      ]),
    ],
    kbTags: ["raise", "salary", "growth"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.value, "impact result revenue saved led"),
    format: (i) => (i.format === "written" ? "doc" : "email"),
    task: (i) =>
      (i.format === "written"
        ? "Write a concise written raise case: the ask, value delivered (cite vault facts), expanded scope, market support if provided, and a proposed review date if the answer is no."
        : "Write a short email asking for a meeting to discuss compensation, previewing two strongest pieces of evidence without making the full case in writing.") +
      " Never use personal financial need as an argument.",
  },
  {
    id: "peer-feedback",
    slug: "peer-feedback-writer",
    engine: "message",
    category: "growth",
    name: "Peer Feedback",
    tagline: "Useful feedback for a colleague, in SBI format.",
    description: "Write specific, kind, actionable peer feedback using Situation-Behaviour-Impact, from your rough notes.",
    icon: "messages",
    fields: [
      text("peerName", "Colleague's name", { required: true }),
      text("relationship", "How you work together", { placeholder: "e.g. same squad, I review their PRs" }),
      area("strengths", "What they do well", { required: true, maxLength: 1500 }),
      area("growth", "Where they could grow", { maxLength: 1500 }),
    ],
    kbTags: ["feedback", "growth"],
    usesVault: false,
    vaultQuery: () => "",
    format: "doc",
    task: () =>
      "Write peer feedback in Situation-Behaviour-Impact form: two or three strengths and one or two actionable growth areas, specific and kind. Use [placeholders] where a concrete example is needed but wasn't given. Leave the subject empty. No variants.",
  },
  {
    id: "career-switch-pitch",
    slug: "career-switch-pitch",
    engine: "message",
    category: "growth",
    name: "Career Switch Pitch",
    tagline: "Explain your pivot so it sounds like a plan.",
    description: "Map your transferable experience to a new field and get a pitch for interviews and LinkedIn, plus the honest gaps to close.",
    icon: "zap",
    fields: [
      text("fromRole", "Current field / role", { required: true, placeholder: "e.g. Mechanical design engineer" }),
      text("toRole", "Target field / role", { required: true, placeholder: "e.g. Data analyst" }),
      area("why", "Why the switch", { maxLength: 1000 }),
      area("progress", "What you've done towards it", { maxLength: 1500, placeholder: "Courses, projects, freelance" }),
      jobDescription(),
    ],
    kbTags: ["gap", "interview", "growth"],
    usesVault: true,
    vaultQuery: (i) => joinQuery(i.toRole, i.progress, i.jobDescription?.slice(0, 1000)),
    format: "doc",
    task: () =>
      "Write a 30-second pivot pitch in the body. Then, as notes, map three transferable strengths (citing vault facts) to the target role, and list the honest gaps with one concrete way to close each. Give a LinkedIn headline + about-opening as the variant. Leave the subject empty.",
  },
];
