import type { AgentAnswer } from "./openai-response";

const fahrenheitUnit = "(?:°\\s*F|℉|degrees?\\s+(?:Fahrenheit|F)|градус(?:ов|а)?\\s+по\\s+Фаренгейту)";
const rangePattern = new RegExp("([+−-]?\\d+(?:[.,]\\d+)?)\\s*[–—]\\s*([+−-]?\\d+(?:[.,]\\d+)?)\\s*" + fahrenheitUnit, "giu");
const numberPattern = new RegExp("([+−-]?\\d+(?:[.,]\\d+)?)\\s*" + fahrenheitUnit, "giu");

function toCelsius(input: string): string {
  const numeric = Number(input.replace("−", "-").replace(",", "."));
  return Number.isFinite(numeric) ? String(Math.round((numeric - 32) * 5 / 9)) : input;
}

/** Convert Fahrenheit readings in weather text without altering other numbers. */
export function fahrenheitToCelsius(text: string): string {
  return text
    .replace(rangePattern, (_, first: string, last: string) => toCelsius(first) + "–" + toCelsius(last) + " °C")
    .replace(numberPattern, (_, value: string) => toCelsius(value) + " °C");
}

/** Citation offsets no longer match if the answer length has changed. */
export function enforceCelsius(answer: AgentAnswer): AgentAnswer {
  const normalized = fahrenheitToCelsius(answer.answer);
  return normalized === answer.answer ? answer : { ...answer, answer: normalized, citations: [] };
}
