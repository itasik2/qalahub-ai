import { getCityProfile, type CityProfile } from "./cities";

/**
 * Read-only Timepad public event provider.
 * Timepad publishes the public events REST API at https://dev.timepad.ru/api/get-v1-events/.
 * Listing an event does not prove tickets are on sale or prices are in KZT.
 */
export type TimepadEvent = {
  id: string;
  cityId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  address: string;
  sourceUrl: string;
  retrievedAt: string;
};

type AnyObject = Record<string, unknown>;

function asObject(value: unknown): AnyObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as AnyObject : null;
}

function textField(value: unknown, max = 250): string {
  return typeof value === "string" ? value.trim().slice(0,max) : "";
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:?\d{2})$/iu.test(value)) return null;
  // Timepad sometimes uses offsets without a colon (+0500).
  const iso = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const instant = Date.parse(iso);
  return Number.isFinite(instant) ? instant : null;
}

function isKazakhstan(value: string): boolean {
  return /^(?:kz|казахстан|қазақстан|kazakhstan|republic of kazakhstan|республика казахстан)$/iu.test(value.trim());
}

function timepadUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "timepad.ru" && !url.hostname.endsWith(".timepad.ru")) return null;
    if (!/^\/event\/\d+(?:\/|$)/u.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

/** Convert only geographically confirmed, future Timepad records. */
export function normalizeTimepadEvents(
  payload: unknown, city: CityProfile, now: Date = new Date(),
): TimepadEvent[] {
  const root = asObject(payload);
  if (!root || !Array.isArray(root.values)) throw new Error("Invalid Timepad response");
  const maxTime = now.getTime() + 21 * 86400_000;
  const items: TimepadEvent[] = [];
  const seen = new Set<string>();
  for (const raw of root.values.slice(0,50)) {
    const event = asObject(raw);
    if (!event || !Number.isSafeInteger(event.id) || Number(event.id) <= 0) continue;
    const location = asObject(event.location);
    if (!location) continue;
    const country = textField(location.country,100);
    const listedCity = textField(location.city,120);
    if (!isKazakhstan(country) || getCityProfile(listedCity)?.id !== city.id) continue;
    const title = textField(event.name,220);
    const address = textField(location.address,220);
    const url = timepadUrl(event.url);
    if (!title || !address || !url) continue;
    if (event.access_status !== undefined && event.access_status !== "public") continue;
    const start = parseTimestamp(event.starts_at);
    const end = event.ends_at === undefined || event.ends_at === null
      ? null : parseTimestamp(event.ends_at);
    if (start === null || (event.ends_at && end === null)) continue;
    if (end !== null && end < start) continue;
    if (start < now.getTime() || start > maxTime) continue;
    const key = String(event.id);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id:key, cityId:city.id, title, address,
      startsAt:new Date(start).toISOString(),
      endsAt:end === null ? null : new Date(end).toISOString(),
      sourceUrl:url,
      retrievedAt:now.toISOString(),
    });
  }
  return items.sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).slice(0,15);
}

export function buildTimepadUrl(city: CityProfile, now: Date): string {
  const url = new URL("https://api.timepad.ru/v1/events.json");
  url.searchParams.set("cities",city.nameRu);
  url.searchParams.set("limit","50");
  url.searchParams.set("sort","+starts_at");
  url.searchParams.set("fields","location");
  url.searchParams.set("starts_at_min",now.toISOString());
  url.searchParams.set("starts_at_max",new Date(now.getTime()+21*86400_000).toISOString());
  return url.href;
}

export async function fetchTimepadEvents(city: CityProfile): Promise<TimepadEvent[]> {
  const started = new Date();
  const response = await fetch(buildTimepadUrl(city,started),{
    headers:{Accept:"application/json", "User-Agent":"QalaHubAI/0.1 (+https://qalahub-ai.vercel.app/)"},
    method:"GET", cache:"no-store", redirect:"error",
    signal:AbortSignal.timeout(16000),
  });
  if (!response.ok) throw new Error("Timepad API request failed: "+response.status);
  const length = Number(response.headers.get("content-length") || 0);
  if(length > 900_000) throw new Error("Timepad response too large");
  const content = await response.text();
  if(content.length > 900_000) throw new Error("Timepad response too large");
  return normalizeTimepadEvents(JSON.parse(content),city,started);
}
