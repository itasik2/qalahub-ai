import { NextRequest, NextResponse } from "next/server";
import { CatalogQueryError, listEvents, parseCatalogFilters } from "../../../lib/city-catalog";
import { DatabaseUnavailableError } from "../../../lib/database";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  let filters;
  try { filters = parseCatalogFilters(request.nextUrl); }
  catch (error) {
    return NextResponse.json({error:error instanceof CatalogQueryError?error.message:"Неверный запрос."},{status:400});
  }
  try {
    const data = await listEvents(filters);
    return NextResponse.json({cityId:filters.cityId,data,source:"database"},{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    console.error("qalahub.events.unavailable",error instanceof DatabaseUnavailableError?"unconfigured":"db-error");
    return NextResponse.json({error:"Каталог мероприятий пока не подключён."},{status:503});
  }
}
