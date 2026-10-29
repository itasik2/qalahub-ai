import assert from "node:assert/strict";
import test from "node:test";
import { groupChatTurns, summarizeQuestion } from "./chat-history";

test("groups questions and answers without dropping previous turns", () => {
  const messages = [
    { role: "user" as const, text: "Где поужинать?" },
    { role: "assistant" as const, text: "Кафе в Астане" },
    { role: "user" as const, text: "А детские мероприятия?" },
    { role: "assistant" as const, text: "Выставка и спектакль" },
  ];
  const turns = groupChatTurns(messages);
  assert.equal(turns.length, 2);
  assert.equal(turns[0].question.text, "Где поужинать?");
  assert.equal(turns[0].answer?.text, "Кафе в Астане");
  assert.equal(turns[1].question.text, "А детские мероприятия?");
  assert.equal(turns[1].answer?.text, "Выставка и спектакль");
  assert.equal(messages.length, 4);
});

test("keeps an unfinished current question visible during a request", () => {
  const turns = groupChatTurns([
    { role: "user" as const, text: "Первый вопрос" },
    { role: "assistant" as const, text: "Ответ" },
    { role: "user" as const, text: "Новый вопрос" },
  ]);
  assert.equal(turns.length, 2);
  assert.deepEqual(turns.slice(0, -1).map(t => t.question.text), ["Первый вопрос"]);
  assert.equal(turns.at(-1)?.question.text, "Новый вопрос");
  assert.equal(turns.at(-1)?.answer, undefined);
});

test("ignores orphaned assistant messages and preserves message metadata", () => {
  const messages = [
    { role: "assistant" as const, text: "orphan", sources: [] },
    { role: "user" as const, text: "Вопрос", sources: [] },
    { role: "assistant" as const, text: "Ответ", sources: [{ title: "Афиша", url: "https://example.kz" }] },
  ];
  const turns = groupChatTurns(messages);
  assert.equal(turns.length, 1);
  assert.equal(turns[0].answer?.sources.length, 1);
});

test("summarizes old questions without modifying originals", () => {
  const text = "Где в Астане поужинать вдвоём с бюджетом 10000 тенге?";
  assert.equal(summarizeQuestion(text, 17), "Где в Астане по…");
  assert.equal(summarizeQuestion("   Новый  запрос  "), "Новый запрос");
});
