// ─── Output Schemas ──────────────────────────────────────────────────────────
// zod schemas handed to generateObject. They replace hand-written validators:
// the SDK validates the model output and the types fall out of z.infer.
// Fields avoid null/optional unions because several providers' JSON modes
// handle them poorly; "empty string / empty array" means "not applicable".

import { z } from "zod";

export const citationSchema = z.object({
  chunkId: z.string().describe("Exact id of the Career Vault chunk this claim comes from"),
  claim: z.string().describe("The fact from that chunk, as used in the text"),
});

export const messageSchema = z.object({
  subject: z.string().describe("Subject line. Empty string when the format has no subject."),
  body: z.string().describe("The ready-to-send text, written in the user's voice. Use \\n for line breaks."),
  variants: z
    .array(z.object({ label: z.string(), body: z.string() }))
    .describe("Up to two alternative versions with a short label each, e.g. 'Shorter' or 'Warmer'."),
  placeholders: z
    .array(z.string())
    .describe("Every [bracketed placeholder] used in the text that the user must fill in."),
  notes: z
    .array(z.string())
    .describe("Up to four short notes: why key choices were made, and what to personalise or check."),
  citations: z
    .array(citationSchema)
    .describe("One entry per fact taken from the Career Vault. Empty when no vault facts were used."),
});

export type MessageResult = z.infer<typeof messageSchema>;
