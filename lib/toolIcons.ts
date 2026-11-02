// ─── Tool icons ──────────────────────────────────────────────────────────────
// iLovePDF-style composite icons: a solid main tile carrying what the tool
// works on, overlapping a small lighter tile carrying what it does to it
// (check it, cut it, send it, put a number on it). Paths are 24x24 strokes.

/** Main symbols, drawn white on the solid tile. */
const G = {
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  fileText: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5",
  bars: "M4 20h16 M6 16v-3 M11 16V9 M16 16V5",
  robot: "M12 2v4 M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M9 11h.01 M15 11h.01 M9 15h6 M2 12h2 M20 12h2",
  github:
    "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22",
  scissors: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M20 4 8.12 15.88 M14.47 14.48 20 20 M8.12 8.12 12 12",
  list: "M9 6h12 M9 12h12 M9 18h12 M4 6h.01 M4 12h.01 M4 18h.01",
  letter: "M3 9l9 6 9-6 M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9 M3 9l9-6 9 6",
  linkedin: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V8h4v1.5A5.98 5.98 0 0 1 16 8z M6 9H2v12h4z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  send: "M22 2 11 13 M22 2l-7 20-4-9-9-4z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6 12 13 2 6",
  heart: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z",
  reply: "M9 17l-5-5 5-5 M20 18v-2a4 4 0 0 0-4-4H4",
  clipboard: "M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 12h6 M9 16h4",
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v3 M8 22h8",
  book: "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  notebook: "M4 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4z M8 2v20 M12 8h4 M12 12h4",
  bubble: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  swap: "M7 16V4 M3 8l4-4 4 4 M17 8v12 M21 16l-4 4-4-4",
  penNib: "M12 19l7-7 3 3-7 7z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z M2 2l7.59 7.59 M11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  scale: "M12 3v18 M7 21h10 M5 7l7-4 7 4 M5 7 2 13a3 3 0 0 0 6 0z M19 7l-3 6a3 3 0 0 0 6 0z",
  exit: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  calendar: "M8 2v4 M16 2v4 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M3 10h18",
  userCheck: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M16 11l2 2 4-4",
  cap: "M22 10 12 5 2 10l10 5 10-5z M6 12v5c3 3 9 3 12 0v-5",
  hourglass:
    "M5 22h14 M5 2h14 M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22 M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2",
  plane:
    "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
  languages: "m5 8 6 6 M4 14l6-6 2-3 M2 5h12 M7 2h1 M22 22l-5-10-5 10 M14 18h6",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  hash: "M4 9h16 M4 15h16 M10 3 8 21 M16 3l-2 18",
  coffee: "M17 8h1a4 4 0 1 1 0 8h-1 M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z M6 2v2 M10 2v2 M14 2v2",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7",
  chart: "M3 3v18h18 M7 16v-4 M12 16V8 M17 16v-6",
  award: "M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M8.21 13.89 7 23l5-3 5 3-1.21-9.12",
  rocket:
    "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0 M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
  coins: "M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M18.09 10.37A6 6 0 1 1 10.34 18 M7 6h1v4 M16.71 13.88l.7.71-2.82 2.82",
  messages: "M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1",
  signpost: "M12 13v8 M12 3v3 M4 6h13l3 3.5-3 3.5H4z",
  flame:
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  gavel: "m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10 M16 16l6-6 M8 8l6-6 M9 7l8 8 M21 11l-8-8",
  sparkles:
    "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z M5 16l.6 1.4L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.6z",
  grid: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 9h18 M3 15h18 M9 3v18 M15 3v18",
};

/** Badges for the small back tile, drawn in the tool's colour. */
const B = {
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18 M6 6l12 12",
  plus: "M12 5v14 M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-4.35-4.35",
  dollar: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z",
  question: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01",
  bang: "M12 4v10 M12 19h.01",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
  up: "M12 19V5 M5 12l7-7 7 7",
  right: "M5 12h14 M12 5l7 7-7 7",
  pen: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  snow: "M12 2v20 M4.93 4.93l14.14 14.14 M2 12h20 M4.93 19.07 19.07 4.93",
  heart: G.heart,
  smile: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M8 14s1.5 2 4 2 4-2 4-2 M9 9h.01 M15 9h.01",
  doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6",
  send: G.send,
  mail: G.mail,
  calendar: G.calendar,
  swap: "M21 12a9 9 0 0 0-15-6.7L3 8 M3 3v5h5 M3 12a9 9 0 0 0 15 6.7l3-2.7 M21 21v-5h-5",
  bubble: G.bubble,
  flame: G.flame,
  list: "M9 6h12 M9 12h12 M9 18h12 M4 6h.01 M4 12h.01 M4 18h.01",
  rewind: "M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5",
};

export interface ToolIconSpec {
  /** main symbol on the solid tile */
  glyph: string;
  /** small badge on the lighter back tile; omitted for single-tile icons */
  badge?: string;
}

export const TOOL_ICONS: Record<string, ToolIconSpec> = {
  // Find jobs
  "job-fit-check": { glyph: G.target, badge: B.check },
  "jd-decoder": { glyph: G.fileText, badge: B.search },
  "skill-gap-plan": { glyph: G.bars, badge: B.plus },
  // Resume
  "ats-check": { glyph: G.robot, badge: B.doc },
  "proof-check": { glyph: G.github, badge: B.check },
  "tailor-resume": { glyph: G.scissors, badge: B.doc },
  "bullet-fixer": { glyph: G.list, badge: B.spark },
  "cover-letter": { glyph: G.letter, badge: B.pen },
  "linkedin-optimizer": { glyph: G.linkedin, badge: B.up },
  // Reach out
  "cold-recruiter-message": { glyph: G.send, badge: B.snow },
  "referral-request": { glyph: G.users, badge: B.plus },
  "application-follow-up": { glyph: G.mail, badge: B.clock },
  "thank-you-note": { glyph: G.heart, badge: B.mail },
  "rejection-reply": { glyph: G.reply, badge: B.x },
  // Interview
  "interview-prep-pack": { glyph: G.clipboard, badge: B.question },
  "mock-interview": { glyph: G.mic },
  "star-story-builder": { glyph: G.book, badge: B.star },
  "tell-me-about-yourself": { glyph: G.user, badge: B.bubble },
  "interview-debrief": { glyph: G.notebook, badge: B.rewind },
  "salary-expectation-script": { glyph: G.bubble, badge: B.dollar },
  // Offer
  "offer-comparator": { glyph: G.scale, badge: B.dollar },
  "negotiate-offer": { glyph: G.swap, badge: B.dollar },
  "accept-offer": { glyph: G.penNib, badge: B.check },
  "decline-offer": { glyph: G.fileText, badge: B.x },
  // Join & leave
  "resignation-letter": { glyph: G.exit, badge: B.flame },
  "notice-period-request": { glyph: G.calendar, badge: B.clock },
  "reference-request": { glyph: G.userCheck, badge: B.star },
  "internship-conversion": { glyph: G.cap, badge: B.right },
  "gap-explainer": { glyph: G.hourglass, badge: B.bubble },
  // At work
  "email-tone-fixer": { glyph: G.mail, badge: B.smile },
  "leave-request": { glyph: G.plane, badge: B.calendar },
  "corporate-speak-translator": { glyph: G.languages, badge: B.swap },
  "hr-concern-writeup": { glyph: G.shield, badge: B.bang },
  "new-joiner-intro": { glyph: G.hash, badge: B.smile },
  "one-on-one-agenda": { glyph: G.coffee, badge: B.list },
  "thirty-sixty-ninety-plan": { glyph: G.flag, badge: B.calendar },
  "manager-update": { glyph: G.chart, badge: B.send },
  // Grow
  "self-review-writer": { glyph: G.award, badge: B.pen },
  "promotion-case": { glyph: G.rocket, badge: B.up },
  "raise-request": { glyph: G.coins, badge: B.up },
  "peer-feedback": { glyph: G.messages, badge: B.heart },
  "career-switch-pitch": { glyph: G.signpost, badge: B.spark },
  // Just for fun
  "resume-roast": { glyph: G.flame, badge: B.doc },
  "resume-court": { glyph: G.gavel },
  "employment-aura": { glyph: G.sparkles },
  "corporate-bingo": { glyph: G.grid, badge: B.check },
};

export const FALLBACK_ICON: ToolIconSpec = { glyph: G.bubble };

/** The Apply to this job workflow is not a preset, so its icon lives outside TOOL_ICONS. */
export const APPLY_ICON: ToolIconSpec = { glyph: G.fileText, badge: B.check };
