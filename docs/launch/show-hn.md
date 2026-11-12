# Show HN draft

**Title:** Show HN: iloveemployment – 46 job-search tools that cite your resume for every claim

**URL:** https://iloveemployment.vercel.app

**First comment (post right after submitting):**

I built this because every AI resume tool I tried invented things: a skill I never listed, a metric I never hit. This is iLovePDF but for job hunting, with one rule: nothing about you gets invented.

How it works: you import your resume once and it becomes a "vault" stored in your browser (IndexedDB). Each tool reads a job posting or situation, drafts from vault chunks, and cites the chunk behind every claim. Code, not the model, then drops fake citations, flags figures that aren't in your material and strips skills that appear nowhere in your source. Fit scores, ATS coverage and offer math are computed in code from the model's evidence classification, with the formula shown.

What's there: 46 tools (fit check, tailor resume, cover letter, interview prep, offer comparison, negotiation, resignation letter and more), an "apply to this job" agent loop with step budgets and gates, and 520 offline tests plus retrieval/profile eval gates in CI.

Free tier is one run a day on a hosted open model (Groq, failing over to Gemini). Bring your own key from nine providers for unlimited runs. The key lives in sessionStorage and is never stored server-side.

Stack: Next.js 15, Vercel AI SDK, Supabase for sign-in and the daily counter, Transformers.js for in-browser embeddings. MIT licensed: https://github.com/PranavJha-3000/IloveEmployement

Feedback I'd most like: tools you'd want that are missing, and any case where it still invents something about you.

## Before posting
- Confirm the free tier works on the live site (model fix deployed).
- Post Tue-Thu, roughly 8-10am US Eastern.
- Be at the keyboard for the first few hours to answer comments.
