import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentAnswer } from "./openai-response";

test("returns response text and unique clickable citations", () => {
  const result = parseAgentAnswer({
    output: [{
      type: "message",
      content: [{
        type: "output_text", text: "В Астане есть мероприятия.",
        annotations: [
          { type: "url_citation", url: "https://example.kz/event", title: "Афиша" },
          { type: "url_citation", url: "https://example.kz/event", title: "Афиша" },
          { type: "url_citation", url: "javascript:alert(1)", title: "Unsafe" },
        ],
      }],
    }],
  });
  assert.equal(result.answer, "В Астане есть мероприятия.");
  assert.deepEqual(result.sources, [{ title: "Афиша", url: "https://example.kz/event" }]);
});

test("fails closed when no output is present", () => {
  assert.throws(() => parseAgentAnswer({ output: [] }), /Empty AI answer/);
});
