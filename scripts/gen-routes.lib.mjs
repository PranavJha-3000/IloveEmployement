/**
 * Route generator helper — refactors AI API routes to use the shared pipeline.
 * Run once: `node scripts/gen-routes.mjs`
 *
 * Each route becomes a thin wrapper over standardAIHandler from lib/pipeline.ts,
 * which centralizes: config validation, input limits, JSON extraction, output
 * validation, and error classification (auth / rate-limit / timeout / model / JSON).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const API_DIR = join(process.cwd(), "app", "api");

// ─── Validation line builders ───────────────────────────────────────────────
export const REQ = (field, label, max = 20_000) =>
  `{ const e = validateNonEmpty(b.${field}, ${JSON.stringify(label)}, ${max}); if (e) return e; }`;

export const OPT_LEN = (field, max, label) =>
  `{ const v = b.${field}; if (typeof v === "string" && v.length > ${max}) return ${JSON.stringify(`${label} is too long.`)}; }`;

export const URL_VAL = (field, label) =>
  `{ const u = validateUrl(b.${field}, ${JSON.stringify(label)}); if (u) return u; }`;

// ─── Route template ─────────────────────────────────────────────────────────
export function routeTemplate(ctx) {
  const lines = [];
  lines.push(
    `/**
 * ${ctx.title}.
 * Uses the shared analysis pipeline from lib/pipeline.ts.
 */`,
  );
  lines.push("");
  lines.push(`import { NextResponse, type NextRequest } from "next/server";`);
  lines.push(`import type { ${ctx.bodyType} } from "@/lib/types";`);
  lines.push(`import { ${ctx.builder} } from "@/lib/prompts";`);
  lines.push(
    `import { validateConfig, validateNonEmpty, validateUrl, buildProfileContexts, standardAIHandler } from "@/lib/pipeline";`,
  );
  lines.push(`import { ${ctx.validator} } from "@/lib/utils";`);
  lines.push("");
  lines.push(`export const maxDuration = 60;`);
  lines.push("");
  lines.push(`export async function POST(req: NextRequest) {`);
  lines.push(`  let body: ${ctx.bodyType};`);
  lines.push(`  try {`);
  lines.push(`    body = await req.json();`);
  lines.push(`  } catch {`);
  lines.push(
    `    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });`,
  );
  lines.push(`  }`);
  lines.push("");
  lines.push(`  const result = await standardAIHandler(body, {`);
  lines.push(`    validateInput: (b) => {`);
  lines.push(`      { const c = validateConfig(b.config); if (c) return c; }`);
  for (const v of ctx.validations) {
    for (const l of v) lines.push(`      ${l}`);
  }
  lines.push(`      return null;`);
  lines.push(`    },`);
  lines.push(`    buildPrompts: async (b) => {`);
  for (const l of ctx.prompt) lines.push(`      ${l}`);
  lines.push(`    },`);
  lines.push(`    validateOutput: (out) => ${ctx.validator}(out),`);
  if (ctx.isEmpty) lines.push(`    isEmpty: (r) => ${ctx.isEmpty},`);
  if (ctx.emptyMsg) lines.push(`    emptyMessage: ${JSON.stringify(ctx.emptyMsg)},`);
  lines.push(`    temperature: ${ctx.temp ?? 0.6},`);
  lines.push(`  });`);
  lines.push("");
  lines.push(`  if ("error" in result) {`);
  lines.push(
    `    return NextResponse.json({ error: result.error.message }, { status: result.error.status });`,
  );
  lines.push(`  }`);
  lines.push(`  return NextResponse.json(result.data);`);
  lines.push(`}`);
  lines.push("");
  return lines.join("\n");
}

export function emit(route) {
  const dir = join(API_DIR, route.dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "route.ts"), route.content, "utf8");
  console.log("✓", route.dir);
}