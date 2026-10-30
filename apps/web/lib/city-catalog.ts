import { getCityProfile, KZ_CITY_PROFILES } from "./cities";
import { cityDatabase } from "./database";

export type PublicCity = {
  id: string;
  nameRu: string;
  nameKk: string | null;
  coverage: "pilot" | "experimental" | "supported";
  timezone: string;
  countryCode: "KZ";
};
export type CityDirectory = { data: PublicCity[]; source: "seed" | "database" };
export type CatalogFilters = { cityId: string; q: string; category: string; limit: number };

export class CatalogQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogQueryError";
  }
}

export function parseCatalogFilters(url: URL): CatalogFilters {
  const city = getCityProfile(url.searchParams.get("city") ?? "");
  if (!city) throw new CatalogQueryError("Укажите город Казахстана параметром city.");
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const rawLimit = url.searchParams.get("limit") ?? "20";
  if (q.length > 120 || category.length > 60) {
    throw new CatalogQueryError("Слишком длинный поисковый фильтр.");
  }
  if (category && !/^[\p{L}\p{N}_ -]+$/u.test(category)) {
    throw new CatalogQueryError("Некорректная категория.");
  }
  if (!/^\d{1,2}$/u.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 30) {
    throw new CatalogQueryError("Параметр limit должен быть от 1 до 30.");
  }
  return { cityId: city.id, q, category, limit: Number(rawLimit) };
}

export function getSeedCities(): CityDirectory {
  return {
    source: "seed",
    data: KZ_CITY_PROFILES.map(c => ({
      id: c.id,
      nameRu: c.nameRu,
      nameKk: c.nameKk ?? null,
      coverage: c.coverage,
      timezone: c.timezone,
      countryCode: "KZ" as const,
    })),
  };
}

export async function listCities(): Promise<CityDirectory> {
  if (!process.env.DATABASE_URL) return getSeedCities();

  const sql = cityDatabase();
  const rows = await sql.query(
    "SELECT id, name_ru, name_kk, timezone, coverage, country_code FROM city WHERE country_code='KZ' ORDER BY CASE WHEN coverage='pilot' THEN 0 ELSE 1 END, name_ru",
    [],
  );
  if (!rows.length) return getSeedCities();

  return {
    source: "database",
    data: rows.map(row => ({
      id: String(row.id),
      nameRu: String(row.name_ru),
      nameKk: row.name_kk === null ? null : String(row.name_kk),
      timezone: String(row.timezone),
      coverage: row.coverage as PublicCity["coverage"],
      countryCode: "KZ" as const,
    })),
  };
}

export type PublicPlace = {
  id: string;
  cityId: string;
  name: string;
  category: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  source: { providerId: string; url: string; retrievedAt: string; verifiedAt: string | null };
};
export async function listPlaces(filters: CatalogFilters): Promise<PublicPlace[]> {
  const sql = cityDatabase();
  const rows = await sql.query(
    "SELECT id::text, city_id, name, category, address, latitude, longitude, provider_id, source_url, retrieved_at, verified_at "+
    "FROM city_place WHERE city_id=$1 AND ($2='' OR category=$2) "+
    "AND ($3='' OR name ILIKE '%' || $3 || '%' OR coalesce(address,'') ILIKE '%' || $3 || '%') "+
    "ORDER BY name, id LIMIT $4",
    [filters.cityId, filters.category, filters.q, filters.limit],
  );
  return rows.map(row=>({
    id: String(row.id), cityId: String(row.city_id),
    name: String(row.name), category: String(row.category),
    address: row.address === null ? null : String(row.address),
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    source: {
      providerId: String(row.provider_id),
      url: String(row.source_url),
      retrievedAt: new Date(row.retrieved_at).toISOString(),
      verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
    },
  }));
}

export type PublicEvent = {
  id: string;cityId: string;title: string;category: string;
  startsAt: string;endsAt: string|null;placeId: string|null;
  priceMinKzt: number|null;priceMaxKzt: number|null;ticketUrl: string|null;
  source: {providerId:string;url:string;retrievedAt:string;verifiedAt:string|null};
};
export async function listEvents(filters: CatalogFilters, now: Date = new Date()): Promise<PublicEvent[]> {
  const sql = cityDatabase();
  const rows = await sql.query(
    "SELECT id::text, city_id, title, category, starts_at, ends_at, place_id::text, "+
    "price_min_kzt, price_max_kzt, ticket_url, provider_id, source_url, retrieved_at, verified_at "+
    "FROM city_event WHERE city_id=$1 AND status='scheduled' "+
    "AND coalesce(ends_at,starts_at) >= $2::timestamptz "+
    "AND ($3='' OR category=$3) AND ($4='' OR title ILIKE '%' || $4 || '%') "+
    "ORDER BY starts_at, id LIMIT $5",
    [filters.cityId, now.toISOString(), filters.category, filters.q, filters.limit],
  );
  return rows.map(row=>({
    id: String(row.id), cityId: String(row.city_id),
    title: String(row.title),category: String(row.category),
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    placeId: row.place_id ? String(row.place_id) : null,
    priceMinKzt: row.price_min_kzt === null ? null : Number(row.price_min_kzt),
    priceMaxKzt: row.price_max_kzt === null ? null : Number(row.price_max_kzt),
    ticketUrl: row.ticket_url === null ? null : String(row.ticket_url),
    source: {
      providerId: String(row.provider_id),url: String(row.source_url),
      retrievedAt: new Date(row.retrieved_at).toISOString(),
      verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
    },
  }));
}
