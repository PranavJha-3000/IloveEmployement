// Offline tests of the agent workflow config and policy. No network, no model calls.
import assert from "node:assert";
import { test } from "node:test";
import {
  AGENT_STEP_BUDGET,
  AGENT_TOKEN_BUDGET,
  AGENT_TOOLS,
  AGENT_TOOL_PRESETS,
  AGENT_WORK_TOOLS,
} from "../lib/agent/config";
import { getPresetById } from "../lib/presets";

test("every agent work tool maps to a real preset id", () => {
  for (const tool of AGENT_WORK_TOOLS) {
    assert.ok(getPresetById(AGENT_TOOL_PRESETS[tool]), `${tool} -> ${AGENT_TOOL_PRESETS[tool]}`);
  }
});

test("agent tools are exactly the five names including finish", () => {
  assert.deepStrictEqual(
    [...AGENT_TOOLS],
    ["fit_check", "tailor_resume", "cover_letter", "outreach_message", "finish"],
  );
});

test("budget constants", () => {
  assert.strictEqual(AGENT_STEP_BUDGET, 6);
  assert.strictEqual(AGENT_TOKEN_BUDGET, 50000);
});
