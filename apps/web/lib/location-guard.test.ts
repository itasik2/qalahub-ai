import assert from "node:assert/strict";
import test from "node:test";
import { filterLocalDiscovery, isLocalDiscoveryConversation, validateLocalDiscovery } from "./location-guard";
import type { AgentAnswer } from "./openai-response";

const reply = (answer: string, sources: AgentAnswer["sources"]): AgentAnswer => ({
  answer, sources, citations: [],
});
const local = { title: "Театр Астаны", url: "https://example.kz/astana/show" };
const foreign = { title: "Концерт в Минске", url: "https://metalheads.by/events/minsk/rock" };

test("removes Minsk item and keeps Astana item from same response", () => {
  const response = reply(
    "1. Спектакль в Астане — [афиша](https://example.kz/astana/show)\n" +
    "2. Концерт в Минске — [билеты](https://metalheads.by/events/minsk/rock)",
    [local, foreign],
  );
  const result = filterLocalDiscovery("Астана", "Какие мероприятия в Астане?", response);
  assert.equal(result.valid, true);
  assert.equal(result.removedRecommendations, 1);
  assert.equal(result.removedSources, 1);
  assert.match(result.answer.answer, /Спектакль в Астане/);
  assert.doesNotMatch(result.answer.answer, /Минск/);
  assert.equal(result.answer.sources.length, 1);
  assert.equal(result.answer.sources[0].url, local.url);
});

test("does not reject a confirmed Astana concert by an artist from Moscow", () => {
  const result = filterLocalDiscovery("Астана", "Какие концерты?", reply(
    "Группа из Москвы выступает в Астане. [Билеты](https://example.kz/astana/show)",
    [local],
  ));
  assert.equal(result.valid, true);
  assert.match(result.answer.answer, /Группа из Москвы/);
});

test("wrong city and Belarusian source with no local alternative fails closed", () => {
  const check = filterLocalDiscovery("Астана", "Что интересного на выходных?", reply(
    "В Минске состоится фестиваль.", [foreign],
  ));
  assert.equal(check.valid, false);
  assert.equal(check.missingSources, true);
  assert.ok(check.removedSources > 0);
});

test("rejects source-free discovery but not general information", () => {
  assert.equal(validateLocalDiscovery("Астана", "Какие концерты?", reply("Сегодня концерт", [])).valid, false);
  assert.equal(validateLocalDiscovery("Астана", "Что такое нейросеть?", reply("Модель", [])).valid, true);
});

test("recognizes geographic follow-up questions from local context", () => {
  const conversation = [
    {role: "user", content: "Какие концерты в Астане?"},
    {role: "assistant", content: "Вот афиша."},
    {role: "user", content: "А на следующей неделе?"},
  ];
  assert.equal(isLocalDiscoveryConversation(conversation), true);
  assert.equal(isLocalDiscoveryConversation([
    ...conversation, {role: "assistant", content: "События"},
    {role: "user", content: "Объясни сортировку массива"},
  ]), false);
});


test("recognizes natural leisure wording without category keywords", () => {
  const result = filterLocalDiscovery("Астана", "Что интересного на выходных?", reply(
    "В Минске состоится фестиваль.", [foreign],
  ));
  assert.equal(result.valid, false);
});
