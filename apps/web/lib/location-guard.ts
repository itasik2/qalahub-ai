import type { AgentAnswer, PublicSource } from "./openai-response";

/**
 * A deterministic pilot safeguard, NOT official verification of a venue.
 * A global search can return a Minsk concert to an Astana user. Rather than
 * rejecting every result when one city name appears, filter contaminated
 * recommendations and their sources one by one.
 *
 * A proper venue/location lookup (licensed places API) is still required.
 */
const cityMatchers: ReadonlyArray<readonly [string, RegExp]> = [
  ["Астана", /астан[аыеойу]|astana|nur.?sultan/iu],
  ["Алматы", /алмат[аыеойуы]|almaty/iu],
  ["Шымкент", /шымкент|shymkent/iu],
  ["Павлодар", /павлодар|pavlodar/iu],
  ["Караганда", /караганд|karaganda/iu],
  ["Актобе", /актобе|ақтөбе|aktobe/iu],
  ["Атырау", /атырау|atyrau/iu],
  ["Актау", /актау|ақтау|aktau/iu],
  ["Костанай", /костанай|қостанай|kostanay/iu],
  ["Тараз", /тараз|taraz/iu],
  ["Усть-Каменогорск", /усть.?каменогорск|oskemen|өскемен/iu],
  ["Кызылорда", /кызылорд|қызылорд|kyzylorda/iu],
  ["Туркестан", /туркестан|түркістан|turkistan/iu],
  ["Кокшетау", /кокшетау|көкшетау|kokshetau/iu],
  ["Петропавловск", /петропавловск|petropavlovsk/iu],
  ["Семей", /семей|семея|semey/iu],
  ["Талдыкорган", /талдыкорган|талдықорған|taldykorgan/iu],
  ["Уральск", /уральск|uralsk/iu],
  ["Жезказган", /жезказган|жезқазған|zhezkazgan/iu],
  ["Конаев", /конаев|қонаев|konaev/iu],
  ["Экибастуз", /экибастуз|екібастұз|ekibastuz/iu],
  ["Аксу", /аксу|ақсу|aksu/iu],
  ["Минск", /минск|minsk|беларус|belarus/iu],
  ["Москва", /москв|moscow|moskva/iu],
  ["Санкт-Петербург", /петербург|petersburg/iu],
  ["Бишкек", /бишкек|bishkek/iu],
  ["Ташкент", /ташкент|tashkent/iu],
  ["Казань", /казан[ьиюяе]|kazan/iu],
  ["Новосибирск", /новосибирск|novosibirsk/iu],
  ["Екатеринбург", /екатеринбург|yekaterinburg|ekaterinburg/iu],
  ["Гомель", /гомел|gomel/iu],
  ["Варшава", /варшав|warsaw/iu],
];

function namedCities(text: string, selectedCity: string): string[] {
  const normalized = text.replace(/[-_./]+/g, " ");
  return cityMatchers
    .filter(([name, matcher]) => name !== selectedCity && matcher.test(normalized))
    .map(([name]) => name);
}

function isForeignSource(city: string, source: PublicSource): boolean {
  try {
    const url = new URL(source.url);
    if (url.hostname.toLowerCase().endsWith(".by")) return true;
    const text = source.title + " " + decodeURIComponent(url.pathname);
    return namedCities(text, city).length > 0;
  } catch {
    return true;
  }
}

export function isLocalDiscoveryQuery(question: string): boolean {
  return /концерт|афиш|мероприят|спектакл|выставк|фестивал|вечерин|куда\s+(сходить|пойти)|где\s+(поесть|поужинать|позавтракать|погулять)|ресторан|кафе|кофейн|кино|дет[ьми]|досуг|маршрут|парки|парк|мастер|сантехник|электрик/iu.test(question);
}

/** Short follow-up turns inherit the subject of the last discovery question. */
export function isLocalDiscoveryConversation(messages: ReadonlyArray<{role: string; content: string}>): boolean {
  const last = messages.filter((m) => m.role === "user").slice(-1)[0];
  if (!last) return false;
  if (isLocalDiscoveryQuery(last.content)) return true;
  if (last.content.length > 100 || /что такое|объясни|переведи|код|программир|математ/iu.test(last.content)) return false;
  return messages.filter((m) => m.role === "user").slice(-3, -1)
    .some((m) => isLocalDiscoveryQuery(m.content));
}

export function findOutOfCityMentions(city: string, response: AgentAnswer): string[] {
  const found = new Set(namedCities(response.answer, city));
  for (const source of response.sources) {
    namedCities(source.title + " " + source.url, city).forEach((name) => found.add(name));
    try {
      if (new URL(source.url).hostname.endsWith(".by")) found.add("Минск");
    } catch { /* invalid URLs do not count as sources */ }
  }
  return [...found];
}

/**
 * Split text into independently droppable recommendation paragraphs.
 * Numbered/bulleted entries are separate even without blank lines.
 */
function splitRecommendations(text: string): string[] {
  return text.split(/(?=\n\s*(?:\d{1,2}[.)]|[-•*])\s+)/u)
    .flatMap((item) => item.split(/(?<=\n)\n+/u))
    .filter((item) => item.trim());
}

export type LocalDiscoveryDecision = {
  valid: boolean;
  answer: AgentAnswer;
  conflictingCities: string[];
  removedRecommendations: number;
  removedSources: number;
  missingSources: boolean;
};

export function filterLocalDiscovery(
  city: string,
  question: string,
  response: AgentAnswer,
): LocalDiscoveryDecision {
  if (!isLocalDiscoveryQuery(question)) {
    return {
      valid: true, answer: response, conflictingCities: [],
      removedRecommendations: 0, removedSources: 0, missingSources: false,
    };
  }

  const goodSources = response.sources.filter((source) => !isForeignSource(city, source));
  const badSources = response.sources.filter((source) => isForeignSource(city, source));
  const badUrls = badSources.map((source) => source.url);
  const conflicts = new Set<string>();
  const blocks = splitRecommendations(response.answer);
  const kept: string[] = [];

  for (const block of blocks) {
    const mentions = namedCities(block, city);
    const hasSelectedCity = cityMatchers.find(([name]) => name === city)?.[1].test(block) ?? false;
    const linksToWrongCity = badUrls.some((url) => block.includes(url));
    // "Гастроли артистов из Москвы в Астане" is not a Moscow event.
    // With explicit local venue and no cited off-city source, keep the item.
    const foreignLocation = mentions.length > 0 && !hasSelectedCity;
    if (foreignLocation || linksToWrongCity) {
      mentions.forEach((name) => conflicts.add(name));
      if (linksToWrongCity) badSources.forEach((source) =>
        namedCities(source.title + " " + source.url, city).forEach((name) => conflicts.add(name)));
      continue;
    }
    kept.push(block);
  }

  const removedRecommendations = blocks.length - kept.length;
  const cleanedText = kept.join("").trim();

  // If all place/event suggestions were removed, never fabricate a fallback.
  // If there's no remaining source, do not label the answer web-grounded.
  const valid = Boolean(cleanedText && goodSources.length);
  const answer: AgentAnswer = removedRecommendations > 0 || badSources.length > 0
    ? {
        ...response,
        answer: cleanedText,
        sources: goodSources,
        citations: [], // Offsets are no longer valid after dropping text.
      }
    : response;

  return {
    valid, answer,
    conflictingCities: [...conflicts],
    removedRecommendations,
    removedSources: badSources.length,
    missingSources: goodSources.length === 0,
  };
}

export function validateLocalDiscovery(city: string, question: string, response: AgentAnswer) {
  const check = filterLocalDiscovery(city, question, response);
  return {
    valid: check.valid,
    conflictingCities: check.conflictingCities,
    missingSources: check.missingSources,
  };
}
