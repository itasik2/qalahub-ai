/**
 * Read-only OpenStreetMap/Overpass adapter.
 *
 * Each request is bound to coordinates supplied by QalaHub's own city table;
 * clients cannot pass arbitrary coordinates or Overpass QL. Public Overpass
 * instances are for modest use, not a national data scraping pipeline.
 * Attribution: © OpenStreetMap contributors, ODbL.
 */
export type PlaceKind = "food" | "culture";

/** Independent publicly documented Overpass providers; no arbitrary URLs. */
export const OVERPASS_SERVERS = [
  { id:"private-coffee", endpoint:"https://overpass.private.coffee/api/interpreter" },
  { id:"fossgis", endpoint:"https://overpass-api.de/api/interpreter" },
] as const;

export class OverpassLookupError extends Error {
  constructor(readonly reasons: readonly string[]) {
    super("Both public map providers are unavailable");
    this.name = "OverpassLookupError";
  }
}

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
  return '[out:json][timeout:10];nwr' + selectors[kind]
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

/**
 * Failover is attempted only on failure, not to combine two provider datasets.
 * Each request has an 11s deadline. Even two slow mirrors fit Vercel's 35s
 * function budget when paired with the city's DB lookup.
 */
export async function fetchOverpassPlaces(
  kind: PlaceKind, lat: number, lon: number,
  request: typeof fetch = fetch,
): Promise<OsmPlace[]> {
  const q = buildOverpassQuery(kind,lat,lon);
  const failures: string[] = [];
  for (const server of OVERPASS_SERVERS) {
    try {
      const response = await request(server.endpoint,{
        method:"POST",
        headers:{
          "Content-Type":"application/x-www-form-urlencoded",
          "User-Agent":"QalaHubAI/0.1 (+https://qalahub-ai.vercel.app/)",
          Accept:"application/json",
        },
        body:new URLSearchParams({data:q}),
        cache:"no-store",
        signal:AbortSignal.timeout(11000),
      });
      if (!response.ok) {
        failures.push(server.id+":http_"+response.status);
        continue;
      }
      if (Number(response.headers.get("content-length") || 0) > 800000) {
        failures.push(server.id+":too_large");
        continue;
      }
      const body = await response.text();
      if (body.length > 800000) {
        failures.push(server.id+":too_large");
        continue;
      }
      const parsed: unknown = JSON.parse(body);
      // A successful but empty response is valid, not a provider failure.
      return normalizeOsmPlaces(parsed,kind,lat,lon);
    } catch (reason) {
      const code = reason instanceof SyntaxError ? "bad_json"
        : reason instanceof Error && /timeout|abort/iu.test(reason.name) ? "timeout"
        : reason instanceof Error && /Invalid Overpass/iu.test(reason.message) ? "invalid_payload"
        : "network";
      failures.push(server.id+":"+code);
    }
  }
  throw new OverpassLookupError(failures);
}
