# Contributing

Thanks for helping. Small fixes and new tools are both welcome.

**Response time:** I aim to reply to every issue and pull request within 24 hours.

## Set up

```bash
git clone https://github.com/PranavJha-3000/IloveEmployement.git && cd IloveEmployement && npm install && npm run dev
```

Open http://localhost:3000. With no environment variables every tool works with your own API key. Copy `.env.example` to `.env.local` to try the free tier.

## Before you open a PR

```bash
npm run typecheck
npm test
```

Both must pass. The tests need no network.

## Adding a tool

Tools are presets: one entry in `lib/presets/` with fields, knowledge tags and a task instruction. The card, page, validation, grounding and rendering come from the engine. See "Adding a tool" in the README. `tests/prompts.test.ts` lints every preset, including that no instruction invites invention.

## The one rule

Nothing about the user may be invented. A change that makes output less traceable to the user's resume will not be merged.

## Good first issues

Look for the [good first issue](https://github.com/PranavJha-3000/IloveEmployement/labels/good%20first%20issue) label.
