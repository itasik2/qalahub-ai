import assert from "node:assert/strict";
import test from "node:test";
import { findOutOfCityMentions, validateLocalDiscovery } from "./location-guard";
import { tokenizeAssistantText } from "./answer-format";
import { parseChatPayload } from "./chat";

const reply = (answer: string, sources: Array<{url: string;title: string}>) => ({ answer, sources, citations: [] });

test("rejects Minsk concert with misleading Astana source", () => {
  const response = reply("2 ноября в Астане концерт Nyth Land в Минске.", [
    {url: "https://metalheads.by/reports/zima-vsegda-ryadom-v-minske.html", title: "Зима всегда рядом: Минск"},
    {url: "https://kz.kinoafisha.info/astana/", title: "Астана"}
  ]);
  const check = validateLocalDiscovery("Астана", "Какие концерты в выходные?", response);
  assert.equal(check.valid, false);
  assert.ok(check.conflictingCities.includes("Минск"));
});

test("rejects Moscow and a different Kazakhstan city", () => {
  const moscow = reply("Посетите концерт в Москве.", [{url: "https://example.org/moscow", title: "Москва"}]);
  assert.deepEqual(findOutOfCityMentions("Астана", moscow), ["Москва"]);
  assert.equal(validateLocalDiscovery("Астана", "Какие мероприятия в городе?", moscow).valid, false);
  const almaty = reply("Событие в Алматы", [{url: "https://example.kz/almaty", title: "Алматы"}]);
  assert.ok(findOutOfCityMentions("Астана", almaty).includes("Алматы"));
});

test("accepts located event with verifiable source", () => {
  assert.equal(validateLocalDiscovery("Астана", "Куда сходить в выходные?", reply(
    "Выставка в Астане.",
    [{url: "https://example.kz/astana/event", title: "Астана"}]
  )).valid, true);
});

test("blocks source-free event recommendations", () => {
  const check = validateLocalDiscovery("Астана", "Какие концерты?", reply("Есть концерт.", []));
  assert.equal(check.valid, false);
  assert.equal(check.missingSources, true);
});

test("does not require citations for general knowledge question", () => {
  assert.equal(validateLocalDiscovery("Астана", "Что такое нейросеть?", reply("Модель.", [])).valid, true);
});

test("does not accept foreign city as a selected Kazakhstani city", () => {
  for (const city of ["Москва", "Минск", "Paris"]) {
    assert.throws(() => parseChatPayload({city, messages:[{role:"user", content:"Куда сходить?"}]}));
  }
});

test("renders markdown links and bold text as safe tokens", () => {
  const parts = tokenizeAssistantText("## Афиша\n**Концерт**: [сайт](https://example.kz/astana)");
  assert.ok(parts.some(p => p.type === "link" && p.text === "сайт"));
  assert.ok(parts.some(p => p.type === "strong" && p.text === "Концерт"));
  assert.ok(!parts.some(p => p.type === "text" && p.text.includes("## ")));
});
