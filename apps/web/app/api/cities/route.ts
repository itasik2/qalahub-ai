import { NextResponse } from "next/server";
import { listCities } from "../../../lib/city-catalog";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    const directory = await listCities();
    return NextResponse.json(directory, {headers:{"Cache-Control":"no-store"}});
  } catch {
    console.error("qalahub.cities.database_unavailable");
    return NextResponse.json({error:"Не удалось загрузить справочник городов."},{status:503});
  }
}
