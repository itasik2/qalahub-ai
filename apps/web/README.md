# QalaHub AI — web MVP

Next.js App Router: responsive city assistant with live OpenAI Responses API web search.

## Local setup

1. At repository root run npm install.
2. Copy apps/web/.env.example to apps/web/.env.local.
3. Set OPENAI_API_KEY and QALAHUB_ACCESS_CODE (long, random pilot access code).
4. Run npm run dev at the repository root and open http://localhost:3000.
5. Run npm test, npm run typecheck and npm run build to check the workspace.

## Deploy (Vercel)

Import itasik2/qalahub-ai. Use Root Directory = apps/web, Framework = Next.js.
Set OPENAI_API_KEY, QALAHUB_ACCESS_CODE and optionally OPENAI_MODEL in Vercel server environment. Do not expose secret variables via NEXT_PUBLIC_.
Check /api/health after deployment. Live AI chat needs an account with Responses API web search enabled.

## Security / scope

A shared pilot access code is only a temporary safeguard. Before opening the site publicly: add account-based auth, persistent distributed rate limiting, budgets/quotas, observability, abuse prevention, privacy controls and provider terms checks. No direct bookings or payments occur. Chats are not persisted by this app, but user queries are sent to the AI provider and external web search sources may be consulted.

The assistant must cite live sources for time-sensitive facts. Source cards link to actual citations from the model's response; if no verifiable result is found, it should say so rather than fabricate an event or a restaurant.

## География и источники

Запросы Responses API используют `web_search` с явным приближённым местоположением: выбранный город, страна `KZ`, часовой пояс `Asia/Almaty`. Местоположение устройства не запрашивается. Ссылки на источники отображаются отдельно и, если API дал диапазоны аннотаций, непосредственно в ответе. При отсутствии ссылок интерфейс выводит предупреждение о неподтверждённых фактах.

`GET /api/health` показывает `aiConfigured`: наличие обеих серверных переменных, но **не доказывает** работоспособность платного API. Тесты по Астане описаны в `docs/PILOT_ASTANA_EVAL.md`.

## Диалог и погода

«Очистить» сбрасывает историю текущей вкладки и отменяет ожидающий запрос, не меняя город и код пилота. Погодные ответы нормализуются на сервере в градусы Цельсия, даже если внешний источник использует °F.
