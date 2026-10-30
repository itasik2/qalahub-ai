import { getCityProfile } from "./cities";

/** Provider-neutral contracts; no live city data is bundled. */
export type SourceEvidence = {
  providerId: string;
  url: string;
  retrievedAt: string; // ISO 8601
  verifiedAt?: string;
};
export type CityPlace = {
  id: string;
  cityId: string;
  name: string;
  category: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  source: SourceEvidence;
};
export type CityEvent = {
  id: string;
  cityId: string;
  title: string;
  startsAt: string; // ISO timestamp including timezone
  endsAt?: string;
  placeId?: string;
  priceMinKzt?: number;
  priceMaxKzt?: number;
  source: SourceEvidence;
};

function validSource(source: SourceEvidence): boolean {
  if (!source.providerId.trim() || !Number.isFinite(Date.parse(source.retrievedAt))) return false;
  try {
    const url = new URL(source.url);
    return url.protocol==="https:" || url.protocol==="http:";
  } catch { return false; }
}
/** Validates metadata and city ID, but does NOT verify a real-world address. */
export function selectCityPlaces(cityNameOrId: string, items: readonly CityPlace[]): CityPlace[] {
  const city = getCityProfile(cityNameOrId);
  return city ? items.filter(x => x.cityId===city.id && Boolean(x.name.trim()) && validSource(x.source)) : [];
}
/** Restricts events by city and absolute date, not by an ambiguous local string. */
export function selectUpcomingEvents(cityNameOrId: string, items: readonly CityEvent[], now = new Date()): CityEvent[] {
  const city = getCityProfile(cityNameOrId);
  if (!city || !Number.isFinite(now.getTime())) return [];
  return items.filter(e => {
    if (e.cityId!==city.id || !e.title.trim() || !validSource(e.source)) return false;
    if (!/(Z|[+-]\d{2}:\d{2})$/i.test(e.startsAt)) return false;
    if (e.endsAt && !/(Z|[+-]\d{2}:\d{2})$/i.test(e.endsAt)) return false;
    const start = Date.parse(e.startsAt);
    const end = e.endsAt ? Date.parse(e.endsAt) : start;
    return Number.isFinite(start) && Number.isFinite(end) && end >= start && end >= now.getTime();
  }).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
}
