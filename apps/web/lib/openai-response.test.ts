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
  assert.deepEqual(result.citations, []);
});

test("makes the cited span clickable without losing surrounding text", () => {
  const result = parseAgentAnswer({
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: "Событие 29 октября в Астане.",
        annotations: [{
          type: "url_citation", url: "https://theater.kz/event", title: "Театр",
          start_index: 0, end_index: 7,
        }],
      }],
    }],
  });
  assert.equal(result.citations.length, 1);
  assert.equal(result.answer.slice(result.citations[0].startIndex, result.citations[0].endIndex), "Событие");
  assert.equal(result.citations[0].url, "https://theater.kz/event");
});

test("ignores invalid source schemes and out-of-range spans", () => {
  const result = parseAgentAnswer({
    output: [{
      type: "message",
      content: [{
        type: "output_text", text: "Текст.",
        annotations: [
          { type: "url_citation", url: "javascript:alert(1)", start_index: 0, end_index: 5 },
          { type: "url_citation", url: "https://test.kz", start_index: 0, end_index: 300 },
        ],
      }],
    }],
  });
  assert.deepEqual(result.citations, []);
  assert.equal(result.sources.length, 1);
});

test("fails closed when no output is present", () => {
  assert.throws(() => parseAgentAnswer({ output: [] }), /Empty AI answer/);
});
