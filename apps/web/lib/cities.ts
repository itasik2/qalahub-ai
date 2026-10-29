export const KZ_CITIES = [
  "Астана", "Алматы", "Шымкент", "Павлодар", "Караганда",
  "Актобе", "Атырау", "Актау", "Костанай", "Тараз",
  "Усть-Каменогорск", "Кызылорда", "Туркестан", "Кокшетау",
  "Петропавловск", "Семей", "Талдыкорган", "Уральск",
  "Жезказган", "Конаев", "Экибастуз", "Аксу"
] as const;

export function isKazakhstanCity(city: string): boolean {
  return (KZ_CITIES as readonly string[]).includes(city);
}
