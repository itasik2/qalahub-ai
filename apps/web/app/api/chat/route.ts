import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ChatInputError, parseChatPayload } from "../../../lib/chat";
import { parseAgentAnswer } from "../../../lib/openai-response";
import { buildAgentInstructions, createCitySearchTool, getResponseUsage } from "../../../lib/agent-request";
import { filterLocalDiscovery, isLocalDiscoveryConversation } from "../../../lib/location-guard";
import { collectSearchSourceUrls, countSourceMatches } from "../../../lib/source-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  let payload;
  try {
    if (Number(request.headers.get("content-length") || "0") > 26000) {
      return NextResponse.json({ error: "Слишком большой запрос." }, { status: 413 });
    }
    payload = parseChatPayload(await request.json());
  } catch (error) {
    return NextResponse.json({
      error: error instanceof ChatInputError ? error.message : "Некорректный JSON.",
    }, { status: 400 });
  }

  const key = process.env.OPENAI_API_KEY;
  const pilotCode = process.env.QALAHUB_ACCESS_CODE;
  if (!key || !pilotCode) {
    return NextResponse.json({ error: "ИИ пока не настроен администратором." }, { status: 503 });
  }
  if (!sameSecret(payload.accessCode, pilotCode)) {
    return NextResponse.json({ error: "Неверный код доступа к пилоту." }, { status: 403 });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: "Bearer " + key,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: buildAgentInstructions(payload.city, new Date()),
        input: [
          ...payload.messages.slice(0, -1),
          {
            role: "user",
            content: payload.messages[payload.messages.length - 1].content
              + "\n\nГород поиска для этого вопроса: " + payload.city
              + ", Казахстан. Не предлагай мероприятия или места других городов.",
          },
        ],
        tools: [createCitySearchTool(payload.city)],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        max_output_tokens: 1100,
        store: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });

    if (!upstream.ok) {
      console.error("QalaHub AI provider status", upstream.status);
      return NextResponse.json({ error: "Сервис поиска временно недоступен. Попробуйте позднее." }, { status: 502 });
    }

    const upstreamPayload: unknown = await upstream.json();
    const result = parseAgentAnswer(upstreamPayload);
    const lastQuestion = payload.messages[payload.messages.length - 1].content;
    // Follow-up questions like "А на следующей неделе?" retain city rules.
    const localDiscovery = isLocalDiscoveryConversation(payload.messages);
    const validation = filterLocalDiscovery(
      payload.city,
      localDiscovery ? "Какие мероприятия и места? " + lastQuestion : lastQuestion,
      result,
    );
    if (!validation.valid) {
      console.warn("qalahub.chat.geography_rejected", {
        city: payload.city,
        removedRecommendations: validation.removedRecommendations,
        removedSources: validation.removedSources,
        missingSources: validation.missingSources,
      });
      return NextResponse.json({
        error: "Не удалось найти надёжные результаты по выбранному городу. Попробуйте уточнить дату, район или категорию.",
      }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }

    const sourcesConsulted = collectSearchSourceUrls(upstreamPayload);
    const usage = getResponseUsage(upstreamPayload);
    // Anonymous aggregate telemetry, no source URLs, access codes or prompts.
    if (usage) console.info("qalahub.chat.usage", {
      ...usage,
      sourceCount: validation.answer.sources.length,
      searchSourceCount: sourcesConsulted.length,
      correlatedSources: countSourceMatches(validation.answer, sourcesConsulted),
      removedRecommendations: validation.removedRecommendations,
      removedSources: validation.removedSources,
    });
    return NextResponse.json(validation.answer, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("QalaHub AI request failed:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Не удалось получить ответ. Попробуйте ещё раз." }, { status: 502 });
  }
}
