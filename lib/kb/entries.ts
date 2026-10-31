// ─── Knowledge Base ──────────────────────────────────────────────────────────
// Curated, versioned guidance that presets retrieve at run time. Kept short and
// opinionated: each entry is a playbook the model must follow, not an essay.
// Add entries here; tags decide which presets can see them, BM25 ranks them.

export interface KbEntry {
  id: string;
  title: string;
  tags: string[];
  text: string;
}

export const KB_VERSION = "2026-10-31";

export const KB: KbEntry[] = [
  {
    id: "email-basics",
    title: "Professional email fundamentals",
    tags: ["email", "all"],
    text: `Lead with the point (bottom line up front). One email, one ask, stated explicitly near the end. Short paragraphs of 1–3 sentences. Subject lines are specific and scannable ("Follow-up: Backend Engineer application — Priya Sharma"), never "Hi" or "Quick question". Cut filler openers ("I hope this email finds you well", "I am writing to"), apologies for writing, and stacked hedges ("just", "I was wondering if maybe"). Close with a concrete next step and a plain sign-off.`,
  },
  {
    id: "cold-outreach",
    title: "Cold outreach to recruiters and hiring managers",
    tags: ["outreach", "recruiter", "networking"],
    text: `Keep it to roughly 75–125 words; LinkedIn connection notes are capped near 300 characters. Structure: specific hook (why them, why this role), one or two pieces of proof drawn from real experience that map to the role's top requirement, one low-friction ask (a short call, or whether to apply/forward the resume). Never paste the whole resume. Mention the exact role title and, if there is one, the job ID. Personalise with something verifiable about the team or product, not generic flattery. No "I'm passionate about synergy". It is fine to be direct about wanting the role.`,
  },
  {
    id: "referral",
    title: "Asking for a referral",
    tags: ["outreach", "referral", "networking"],
    text: `Make it effortless to say yes: include the job link or ID, a two-line summary of fit the referrer can paste into the referral form, and offer to send the resume. Acknowledge the relationship honestly (former colleague, alumni, someone you have not met). For weak ties, ask for a quick chat or advice first, or explicitly give them an easy out ("totally fine if you'd rather not"). Never pressure, and thank them whatever the outcome.`,
  },
  {
    id: "follow-up",
    title: "Following up on applications and interviews",
    tags: ["outreach", "follow-up", "ghosted"],
    text: `After applying: follow up once after about a week if you have a contact. After an interview: send thanks within 24 hours; if a promised timeline passes, follow up 2–3 business days later. Cap it at two follow-ups per stage, spaced about a week apart; the last one can politely close the loop ("if the role has been filled, I'd appreciate a quick note"). Restate the role and date, add one new piece of value if you have it, and ask a single clear question about next steps or timeline. Never guilt-trip about being ghosted.`,
  },
  {
    id: "thank-you",
    title: "Post-interview thank-you notes",
    tags: ["outreach", "interview", "thank-you"],
    text: `Send within 24 hours, one per interviewer when you have their emails. Reference something specific from that conversation so it can't be a template. Reinforce one strength relevant to what they cared about, and optionally clarify or add to an answer you gave weakly. Keep it under about 150 words and do not re-sell your whole background.`,
  },
  {
    id: "rejection-reply",
    title: "Replying to a rejection",
    tags: ["outreach", "rejection"],
    text: `Reply briefly and graciously: thank them for their time, say you enjoyed learning about the team, and ask to be considered for future roles. A feedback request is fine if it's optional and specific ("anything I could strengthen for similar roles"); many companies can't share it, so don't press. No arguing the decision, no visible disappointment. This keeps the door open; rejected candidates are re-contacted surprisingly often.`,
  },
  {
    id: "negotiation",
    title: "Negotiating an offer",
    tags: ["offer", "negotiation", "salary"],
    text: `Open with genuine enthusiasm for the role, then negotiate. Anchor on evidence: market data for the role and location, competing offers, or the scope of the role. Negotiate total compensation (base, joining bonus, equity, variable, title, start date, remote days, relocation) rather than base alone; when base is capped, ask for a joining bonus or an early compensation review. Make one clear, specific request, slightly above your target and grounded in a reason. Ask "Is there flexibility on…?" not "Can you do better?". Never invent a competing offer. Get the final terms in writing. Phone or video for the conversation, email to confirm.`,
  },
  {
    id: "salary-expectations",
    title: "Answering the salary expectations question",
    tags: ["offer", "salary", "interview"],
    text: `Early in the process, deflect politely by asking for the budgeted range, or give a researched range rather than a single number. Anchor the bottom of your range at or above your real target, since offers tend to land low in a stated range. Tie it to the role's scope and the market, not personal needs. In markets where CTC is standard (e.g. India), be explicit about whether you mean fixed pay or total CTC, and what your current CTC includes. Be honest about current pay where asking is legal and expected; never inflate it, because offers often get verified with payslips.`,
  },
  {
    id: "offer-accept",
    title: "Accepting an offer",
    tags: ["offer", "accept"],
    text: `Accept in writing and confirm the key terms explicitly: title, compensation (fixed and variable), start date, location or remote arrangement, and reporting manager. Ask what you need before day one (documents, background-check forms, laptop shipping). Keep the tone warm and brief. Don't resign from your current job until you have the written offer and any conditions (background check, references) are cleared or clearly low-risk.`,
  },
  {
    id: "offer-decline",
    title: "Declining an offer",
    tags: ["offer", "decline"],
    text: `Decline promptly once decided, and be brief and gracious. A one-line reason is optional ("I've accepted a role that's a closer fit for where I want to grow") and you never owe details or comparisons. Thank the recruiter and the interviewers by name where you can, and express interest in staying in touch. If you would accept at a different number, say that clearly instead of declining, but only if it's true.`,
  },
  {
    id: "resignation",
    title: "Resignation letters",
    tags: ["transition", "resignation"],
    text: `State that you are resigning, your role, and your last working day, computed from the notice period in your contract. Offer a concrete transition: handover document, knowledge transfer, finishing named work. Thank them genuinely but briefly. Put no grievances, criticism or emotional content in writing. Feedback belongs in the exit interview, and even there it should be measured. Tell your manager live (call or in person) before or alongside the letter. Ask about final pay settlement, relieving and experience letters where relevant.`,
  },
  {
    id: "notice-period-india",
    title: "Notice periods, buyouts and early release (India and similar markets)",
    tags: ["transition", "notice-period", "joining", "india"],
    text: `Notice periods of 30, 60 or 90 days are common in Indian tech, often longer for senior roles. The options are to serve the full notice, ask for an early release (the employer agrees to waive part of it), or buy out the remaining notice (pay in lieu, which the new employer sometimes reimburses). Leave adjustment against notice depends on company policy. Ask for early release once your handover plan is credible: propose a specific last day and show how the work will be covered. With the new employer, give an honest date range and update them early if it slips. The relieving letter and experience letter are standard exit documents; confirm you'll receive them.`,
  },
  {
    id: "joining-delay",
    title: "Requesting a later joining date",
    tags: ["transition", "joining"],
    text: `Ask as early as possible, give a brief honest reason (notice period not yet released, relocation, health, family), propose a specific new date, not an open-ended delay, and reaffirm commitment to the role. Offer something that reduces their risk: staying in touch on onboarding, completing paperwork early. Ask them to confirm the revised date in writing.`,
  },
  {
    id: "references",
    title: "Asking someone to be a reference",
    tags: ["transition", "references"],
    text: `Ask permission before listing anyone. Give them an easy out. Share the role, the company, the likely timeline and two or three things you'd like them to speak to, with concrete examples they'll remember. Send your current resume. Tell them who might call. Thank them, and tell them the outcome.`,
  },
  {
    id: "internship-conversion",
    title: "Asking for an internship-to-full-time conversion",
    tags: ["transition", "internship", "growth"],
    text: `Ask your manager directly a few weeks before the internship ends, not on the last day. Show evidence: what you shipped, its impact, and the feedback you've had. Say clearly that you want a full-time offer and ask what the process and timeline are, and what you'd need to demonstrate. If headcount is the blocker, ask about other teams or a referral.`,
  },
  {
    id: "gap-explanation",
    title: "Explaining employment gaps and layoffs",
    tags: ["transition", "gap", "layoff", "interview"],
    text: `Be brief, honest and unapologetic: one or two sentences on the reason (layoff, health, caregiving, study, relocation, a deliberate break), then pivot to what you did or learned and why you're ready now. Layoffs are a business decision, not a performance verdict; saying "my role was part of a company-wide reduction" is enough. Don't over-explain, disclose medical details, or criticise the former employer. Never disguise a gap with fake roles or dates.`,
  },
  {
    id: "leave-request",
    title: "Leave and time-off requests",
    tags: ["work", "leave"],
    text: `Give the exact dates and type of leave, and how much notice you're giving. Include a coverage plan: who covers what, the status of in-flight work, and how reachable you'll be (often "not reachable"). For sick or bereavement leave, keep the reason short; no medical detail is needed. Follow the company process (HR system first, then a message to your manager). Planned leave should be requested well ahead, and earlier still around releases or peak periods.`,
  },
  {
    id: "tone",
    title: "Fixing tone in workplace messages",
    tags: ["work", "tone"],
    text: `Remove passive-aggressive markers: "per my last email", "as previously mentioned", "just a friendly reminder", "going forward please", sarcastic "thanks in advance". Replace them with a neutral restatement of the fact and a clear request with a date. Assume good intent, describe the impact, and state what you need. Cut excessive apology and self-deprecation; one acknowledgement is enough ("Sorry for the slow reply — here's the update"). Put the most important line first for busy readers. Keep the user's meaning, and never add commitments they didn't make.`,
  },
  {
    id: "corporate-speak",
    title: "Corporate jargon in both directions",
    tags: ["work", "jargon"],
    text: `Decoding: translate euphemisms into what they usually signal ("fast-paced" usually means understaffed or shifting priorities; "wear many hats" means a broad, under-defined role; "competitive salary" means the range isn't disclosed), with confidence levels rather than certainty. Encoding: make blunt statements professional without losing the content. Diplomatic is fine, misleading is not.`,
  },
  {
    id: "hr-concern",
    title: "Writing up a workplace concern for HR",
    tags: ["work", "hr"],
    text: `Stick to facts in chronological order: date, time, place, who was involved, what was said or done (quote where possible), and witnesses. Describe the impact on your work, and the outcome you're asking for. Avoid legal conclusions ("harassment", "hostile environment") unless you're sure they apply; describe the behaviour and let the process classify it. Reference the relevant policy if you know it. Keep your own copy of everything, and send it through the official channel. For serious matters, suggest the user also consult an employment lawyer or their local labour authority.`,
  },
  {
    id: "new-joiner",
    title: "First weeks in a new role",
    tags: ["work", "onboarding"],
    text: `Intro messages: who you are, the role, one line of relevant background, one human detail, and an offer to help or ask to learn ("I'd love 20 minutes to understand how your team uses X"). For the first 30/60/90 days: learn (people, systems, metrics), then contribute (an early, visible, low-risk win), then own (a scoped initiative with a measurable outcome). Align on what success looks like with your manager in week one. Run 1:1s from a shared agenda: priorities, blockers, decisions needed, feedback, career.`,
  },
  {
    id: "self-review",
    title: "Self-reviews and promotion cases",
    tags: ["growth", "review", "promotion"],
    text: `Organise by impact, not activity: what changed because of your work, with metrics where the user has them, plus scope (team, org, customers) and how you worked (collaboration, mentoring, judgement). Map evidence to the next level's expectations, and show you are already operating there. Include one honest growth area with a plan. Use specific examples; vague adjectives are forgettable. Promotion and raise cases go to the manager before calibration season, not after.`,
  },
  {
    id: "raise",
    title: "Asking for a raise",
    tags: ["growth", "raise", "salary"],
    text: `Time it after a clear win or ahead of the budget/review cycle. Build the case on value delivered and expanded scope, with market data as support, never on personal financial need. Name a specific number or percentage. If the answer is no, ask what you'd need to show and by when, and agree on a review date. Ask for the meeting, then follow up in writing.`,
  },
  {
    id: "peer-feedback",
    title: "Peer feedback (SBI)",
    tags: ["growth", "feedback"],
    text: `Use Situation, Behaviour, Impact: when and where, the observable behaviour (not personality), and its effect. Balance strengths and growth areas, and make the growth areas actionable. Be specific and kind. Never give feedback on protected characteristics or personal life.`,
  },
  {
    id: "honesty",
    title: "Non-negotiable honesty rules",
    tags: ["all"],
    text: `Use only facts from the user's inputs and Career Vault. Never invent employers, titles, dates, metrics, degrees, skills, tools, competing offers or reasons. When something is needed but unknown, insert a clearly marked [placeholder] and list it. You may rephrase and reframe true facts persuasively; you may not create new ones.`,
  },
];
