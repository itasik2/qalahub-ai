/**
 * Single extensible city registry for Kazakhstan. This is pilot seed data,
 * not a complete national settlement directory.
 */
export type CityCoverage = "pilot" | "experimental";
export type CityProfile = {
  id: string;
  nameRu: string;
  nameKk?: string;
  aliases: readonly string[];
  countryCode: "KZ";
  timezone: string;
  coverage: CityCoverage;
  mentionPattern: RegExp;
};

type CitySeed = readonly [id: string, name: string, pattern: RegExp, aliases?: readonly string[], kk?: string];
const seeds: readonly CitySeed[] = [
  ["astana","Астана",/астан[аыеойу]|astana|nur.?sultan/iu,["Нур-Султан","Nur-Sultan"],"Астана"],
  ["almaty","Алматы",/алмат[аыеойуы]|almaty/iu,["Almaty"],"Алматы"],
  ["shymkent","Шымкент",/шымкент|shymkent/iu,["Shymkent"],"Шымкент"],
  ["pavlodar","Павлодар",/павлодар|pavlodar/iu,[],"Павлодар"],
  ["karaganda","Караганда",/караганд|karaganda/iu,[],"Қарағанды"],
  ["aktobe","Актобе",/актобе|ақтөбе|aktobe/iu,[],"Ақтөбе"],
  ["atyrau","Атырау",/атырау|atyrau/iu,[],"Атырау"],
  ["aktau","Актау",/актау|ақтау|aktau/iu,[],"Ақтау"],
  ["kostanay","Костанай",/костанай|қостанай|kostanay/iu,[],"Қостанай"],
  ["taraz","Тараз",/тараз|taraz/iu,[],"Тараз"],
  ["oskemen","Усть-Каменогорск",/усть.?каменогорск|oskemen|өскемен/iu,["Өскемен"],"Өскемен"],
  ["kyzylorda","Кызылорда",/кызылорд|қызылорд|kyzylorda/iu,[],"Қызылорда"],
  ["turkistan","Туркестан",/туркестан|түркістан|turkistan/iu,[],"Түркістан"],
  ["kokshetau","Кокшетау",/кокшетау|көкшетау|kokshetau/iu,[],"Көкшетау"],
  ["petropavlovsk","Петропавловск",/петропавловск|petropavlovsk/iu,[],"Петропавл"],
  ["semey","Семей",/семей|семея|semey/iu,[],"Семей"],
  ["taldykorgan","Талдыкорган",/талдыкорган|талдықорған|taldykorgan/iu,[],"Талдықорған"],
  ["uralsk","Уральск",/уральск|uralsk/iu,[],"Орал"],
  ["zhezkazgan","Жезказган",/жезказган|жезқазған|zhezkazgan/iu,[],"Жезқазған"],
  ["konaev","Конаев",/конаев|қонаев|konaev/iu,[],"Қонаев"],
  ["ekibastuz","Экибастуз",/экибастуз|екібастұз|ekibastuz/iu,[],"Екібастұз"],
  ["aksu","Аксу",/аксу|ақсу|aksu/iu,[],"Ақсу"],
];

export const KZ_CITY_PROFILES: readonly CityProfile[] = seeds.map(
  ([id, nameRu, mentionPattern, aliases = [], nameKk]) => ({
    id, nameRu, ...(nameKk ? { nameKk } : {}),
    aliases, countryCode:"KZ", timezone:"Asia/Almaty",
    coverage: id === "astana" ? "pilot" : "experimental",
    mentionPattern,
  }),
);

export const KZ_CITIES: readonly string[] = KZ_CITY_PROFILES.map(city => city.nameRu);
const normalize = (s: string) => s.trim().toLocaleLowerCase("ru").replace(/[\s_-]+/gu,"");
export function getCityProfile(value: string): CityProfile | null {
  const query = normalize(value);
  if (!query) return null;
  return KZ_CITY_PROFILES.find(city =>
    [city.id,city.nameRu,city.nameKk,...city.aliases]
      .some(alias => typeof alias === "string" && normalize(alias) === query)
  ) ?? null;
}
export function isKazakhstanCity(city: string): boolean {
  return getCityProfile(city) !== null;
}
