/**
 * Read-only OpenStreetMap/Overpass adapter.
 *
 * Each request is bound to coordinates supplied by QalaHub's own city table;
 * clients cannot pass arbitrary coordinates or Overpass QL. Public Overpass
 * instances are for modest use, not a national data scraping pipeline.
 * Attribution: © OpenStreetMap contributors, ODbL.
 */
export type PlaceKind = "food" | "culture";
export type OsmPlace = {
  id: string;
  name: string;
  category: string;
  address: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  osmUrl: string;
};

type OsmElement = {
  type?: unknown; id?: unknown; lat?: unknown; lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
};

const selectors: Record<PlaceKind, string> = {
  food: '["amenity"~"^(restaurant|cafe|fast_food)$"]',
  culture: '["tourism"~"^(museum|gallery|attraction)$"]',
};

export function parsePlaceKind(input: unknown): PlaceKind | null {
  return input === "food" || input === "culture" ? input : null;
}
export function isValidCenter(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= 40 && lat <= 56 && lon >= 46 && lon <= 88;
}
export function buildOverpassQuery(kind: PlaceKind, lat: number, lon: number): string {
  if (!isValidCenter(lat, lon) || !selectors[kind]) throw new Error("Invalid location");
  const radius = kind === "food" ? 2700 : 3800;
  return '[out:json][timeout:18];nwr' + selectors[kind]
    + '(around:' + radius + ',' + lat.toFixed(6) + ',' + lon.toFixed(6) + ');out center 100;';
}

function distMeters(a: number, b: number, c: number, d: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const x = radians(c - a), y = radians(d - b);
  const k = Math.sin(x / 2) ** 2
    + Math.cos(radians(a)) * Math.cos(radians(c)) * Math.sin(y / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(k), Math.sqrt(1 - k)));
}
function stringTag(tags: Record<string, unknown>, name: string): string {
  return typeof tags[name] === "string" ? (tags[name] as string).trim().slice(0, 160) : "";
}

export function normalizeOsmPlaces(
  payload: unknown, kind: PlaceKind, centerLat: number, centerLon: number,
): OsmPlace[] {
  if (!payload || typeof payload !== "object") throw new Error("Invalid Overpass payload");
  const d = payload as { elements?: unknown };
  if (!Array.isArray(d.elements)) throw new Error("Invalid Overpass elements");
  const radius = kind === "food" ? 2700 : 3800;
  const result: OsmPlace[] = [];
  const seen = new Set<string>();

  for (const raw of d.elements.slice(0, 100)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as OsmElement;
    const osmType = item.type;
    if (osmType !== "node" && osmType !== "way" && osmType !== "relation") continue;
    if (typeof item.id !== "number" || !Number.isSafeInteger(item.id) || item.id < 1) continue;
    const tags = item.tags && typeof item.tags === "object" ? item.tags : {};
    const name = stringTag(tags,"name:ru") || stringTag(tags,"name");
    if (!name) continue;
    const latitude = Number(item.lat ?? item.center?.lat);
    const longitude = Number(item.lon ?? item.center?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const distanceMeters = distMeters(centerLat,centerLon,latitude,longitude);
    if (distanceMeters > radius + 200) continue;
    const type = stringTag(tags,kind === "food" ? "amenity" : "tourism");
    const accepted = kind === "food" ? ["cafe","restaurant","fast_food"] : ["museum","gallery","attraction"];
    if (!accepted.includes(type)) continue;
    const id = osmType + "/" + item.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const street = stringTag(tags,"addr:street");
    const house = stringTag(tags,"addr:housenumber");
    const address = [street,house].filter(Boolean).join(", ") || null;
    result.push({
      id, name, category:type, address,
      latitude,longitude,distanceMeters,
      osmUrl:"https://www.openstreetmap.org/" + osmType + "/" + item.id,
    });
  }
  return result.sort((a,b)=>a.distanceMeters - b.distanceMeters).slice(0,14);
}

export async function fetchOverpassPlaces(
  kind: PlaceKind, lat: number, lon: number,
): Promise<OsmPlace[]> {
  const q = buildOverpassQuery(kind,lat,lon);
  const response = await fetch("https://overpass-api.de/api/interpreter",{
    method:"POST",
    headers:{
      "Content-Type":"application/x-www-form-urlencoded",
      "User-Agent":"QalaHubAI/0.1 (+https://qalahub-ai.vercel.app/)",
      Accept:"application/json",
    },
    body:new URLSearchParams({data:q}),
    cache:"no-store",
    signal:AbortSignal.timeout(19000),
  });
  if (!response.ok) throw new Error("Overpass service unavailable: " + response.status);
  const body = await response.text();
  if(body.length > 800000) throw new Error("Overpass response too large");
  return normalizeOsmPlaces(JSON.parse(body),kind,lat,lon);
}
