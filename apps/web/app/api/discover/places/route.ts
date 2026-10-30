import { createHash, timingSafeEqual } from "node:crypto";
import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { cityDatabase } from "../../../../lib/database";
import { getCityProfile } from "../../../../lib/cities";
import { fetchOverpassPlaces, isValidCenter, parsePlaceKind, type PlaceKind } from "../../../../lib/osm-places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35;

const CREDITS = {
  label: "© OpenStreetMap contributors (ODbL)",
  url: "https://www.openstreetmap.org/copyright",
};

/**
 * Cached per selected city and category; users never call Overpass directly.
 * The public Overpass endpoint is not a production-scale data feed.
 */
const searchCached = unstable_cache(
  async (_cityId: string, category: PlaceKind, lat: number, lon: number) =>
    fetchOverpassPlaces(category, lat, lon),
  ["qalahub-osm-place-search-v1"],
  { revalidate: 21600 },
);

function sameSecret(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 2048) {
    return NextResponse.json({ error: "Слишком большой запрос." }, {status:413});
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({error:"Некорректный JSON."},{status:400});
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({error:"Некорректный запрос."},{status:400});
  }
  const data = body as Record<string,unknown>;
  const city = typeof data.city === "string" ? getCityProfile(data.city) : null;
  const category = parsePlaceKind(data.category);
  const code = typeof data.accessCode === "string" && data.accessCode.length <= 200 ? data.accessCode : "";
  if (!city || !category) {
    return NextResponse.json({error:"Выберите город и категорию поиска."},{status:400});
  }
  const expected = process.env.QALAHUB_ACCESS_CODE;
  if (!expected) return NextResponse.json({error:"Пилотный доступ не настроен."},{status:503});
  if (!sameSecret(code, expected)) {
    return NextResponse.json({error:"Неверный код доступа к пилоту."},{status:403});
  }

  try {
    const sql = cityDatabase();
    const rows = await sql.query(
      "SELECT latitude, longitude FROM city WHERE id=$1 AND country_code='KZ' LIMIT 1", [city.id],
    );
    const lat = Number(rows[0]?.latitude), lon = Number(rows[0]?.longitude);
    if (rows.length === 0 || rows[0].latitude === null || rows[0].longitude === null || !isValidCenter(lat, lon)) {
      return NextResponse.json({
        error: "Поиск по карте для этого города пока не подключён. Можно воспользоваться обычным ИИ-поиском.",
      }, {status:422});
    }
    const places = await searchCached(city.id,category,lat,lon);
    return NextResponse.json({
      cityId:city.id, city:city.nameRu, category, data:places,
      searchedAround:"Центральная часть города, не ваше местоположение",
      source:"OpenStreetMap",
      attribution:CREDITS,
      notice:"Адрес, часы работы, цены и актуальность заведений требуют уточнения.",
    }, {headers:{"Cache-Control":"no-store"}});
  } catch {
    console.error("qalahub.osm.places_failed");
    return NextResponse.json({
      error:"Источник карты сейчас недоступен. Попробуйте позднее или используйте ИИ-поиск.",
    }, {status:503,headers:{"Cache-Control":"no-store"}});
  }
}
