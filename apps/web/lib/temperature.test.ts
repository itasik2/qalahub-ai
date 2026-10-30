import assert from "node:assert/strict";
import test from "node:test";
import { enforceCelsius, fahrenheitToCelsius } from "./temperature";

test("converts Fahrenheit temperatures to Celsius", () => {
  assert.equal(fahrenheitToCelsius("Сейчас 68°F, ночью 32 °F."), "Сейчас 20 °C, ночью 0 °C.");
  assert.equal(fahrenheitToCelsius("Похолодает до -4 ℉."), "Похолодает до -20 °C.");
  assert.equal(fahrenheitToCelsius("Температура 86 градусов по Фаренгейту."), "Температура 30 °C.");
});

test("converts temperature range but leaves currency untouched", () => {
  assert.equal(fahrenheitToCelsius("Прогноз 32–50 °F, вечером 10 °C, билет 6000 ₸."),
    "Прогноз 0–10 °C, вечером 10 °C, билет 6000 ₸.");
});

test("source citations reset only when a temperature changed", () => {
  const answer = {
    answer: "Вечером 68°F.", sources: [{title:"Прогноз",url:"https://example.kz"}],
    citations: [{startIndex:0,endIndex:7,url:"https://example.kz",title:"Прогноз"}],
  };
  const updated = enforceCelsius(answer);
  assert.equal(updated.answer,"Вечером 20 °C.");
  assert.equal(updated.citations.length,0);
  assert.equal(updated.sources.length,1);
  const already = {...answer,answer:"Сегодня 18 °C."};
  assert.equal(enforceCelsius(already),already);
});
