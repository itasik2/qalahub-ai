import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentInstructions, createCitySearchTool, getResponseUsage } from "./agent-request";

test("web lookup uses the selected city in Kazakhstan", () => {
  assert.deepEqual(createCitySearchTool("Астана"), {
    type: "web_search",
    search_context_size: "medium",
    user_location: {
      type: "approximate",
      country: "KZ",
      city: "Астана",
      timezone: "Asia/Almaty",
    },
  });
});

test("instructions honor local Kazakhstan date and require genuine sources", () => {
  const prompt = buildAgentInstructions("Астана", new Date("2026-10-28T20:30:00.000Z"));
  assert.match(prompt, /Астана, Казахстан/);
  assert.match(prompt, /29 октября 2026/);
  assert.match(prompt, /первоисточники/);
  assert.match(prompt, /Не выдумывай/);
  assert.match(prompt, /не подключены/);
});

test("usage summary never contains user prompt content", () => {
  const usage = getResponseUsage({
    usage: { input_tokens: 123, output_tokens: 80 },
    output: [{ type: "web_search_call" }, { type: "message", content: "private" }],
  });
  assert.deepEqual(usage, { inputTokens: 123, outputTokens: 80, searches: 1 });
});
