import type { AgentAnswer } from "./openai-response";

// This is a conservative safety net for wrongly located event/place results.
// Structured geographic verification against official sources is still needed.
const knownCities: Array<[string, RegExp]> = [
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

export function isLocalDiscoveryQuery(question: string): boolean {
  return /концерт|афиш|мероприят|спектакл|выставк|фестивал|вечерин|куда\s+(сходить|пойти)|где\s+(поесть|поужинать|позавтракать|погулять)|ресторан|кафе|кофейн|кино|дет[ьми]|досуг|маршрут|парки|парк|мастер|сантехник|электрик/iu.test(question);
}

export function findOutOfCityMentions(city: string, response: AgentAnswer): string[] {
  // Every cited URL is examined too: a link to minsk.html must never be shown
  // as local evidence even if the model does not name Minsk in its prose.
  const text = [response.answer, ...response.sources.flatMap(s => [s.title, s.url])]
    .join("\n").replace(/[-_./]/g, " ");
  const matches = knownCities.filter(([name, re]) => name !== city && re.test(text))
    .map(([name]) => name);
  for (const source of response.sources) {
    try {
      if (new URL(source.url).hostname.endsWith(".by") && !matches.includes("Минск")) matches.push("Минск");
    } catch { /* already vetted by citation parser */ }
  }
  return matches;
}

export function validateLocalDiscovery(city: string, question: string, response: AgentAnswer) {
  if (!isLocalDiscoveryQuery(question)) {
    return { valid: true, conflictingCities: [] as string[], missingSources: false };
  }
  const conflictingCities = findOutOfCityMentions(city, response);
  const missingSources = response.sources.length === 0;
  return { valid: conflictingCities.length === 0 && !missingSources, conflictingCities, missingSources };
}
