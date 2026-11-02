import { createHash, timingSafeEqual } from "node:crypto";
import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCityProfile } from "../../../../lib/cities";
import { fetchTimepadEvents } from "../../../../lib/timepad-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Cache per city for 30 minutes, rather than calling Timepad for each user. */
const cachedEvents = unstable_cache(
  async (cityId: string) => {
    const profile = getCityProfile(cityId);
    return profile ? fetchTimepadEvents(profile) : [];
  },
  ["qalahub-timepad-public-events-v1"],
  { revalidate: 1800 },
);

function sameSecret(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a,b);
}

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || "0") > 2048) {
    return NextResponse.json({error:"Слишком большой запрос."},{status:413});
  }
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({error:"Некорректный JSON."},{status:400}); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({error:"Некорректные данные."},{status:400});
  }
  const body = raw as Record<string,unknown>;
  const city = typeof body.city === "string" ? getCityProfile(body.city) : null;
  const code = typeof body.accessCode === "string" && body.accessCode.length <= 200 ? body.accessCode : "";
  if (!city) return NextResponse.json({error:"Выберите город Казахстана."},{status:400});
  const secret = process.env.QALAHUB_ACCESS_CODE;
  if (!secret) return NextResponse.json({error:"Пилотный доступ не настроен."},{status:503});
  if (!sameSecret(code,secret)) return NextResponse.json({error:"Неверный код пилота."},{status:403});

  try {
    const data = (await cachedEvents(city.id))
      .filter(e=>Date.parse(e.startsAt)>=Date.now())
      .slice(0,15);
    return NextResponse.json({
      cityId:city.id, city:city.nameRu, data,
      source:"Timepad public events",
      sourceDocs:"https://dev.timepad.ru/api/get-v1-events/",
      coverage:"Только события, опубликованные на Timepad. Это не полная афиша города.",
      notice:"Город, дата и адрес сверены с данными организатора на Timepad. Наличие билетов и цены не проверены.",
    },{headers:{"Cache-Control":"no-store"}});
  } catch {
    console.error("qalahub.events.timepad_unavailable");
    return NextResponse.json({
      error:"Источник афиши Timepad сейчас недоступен. Можно попробовать обычный ИИ-поиск.",
    },{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
