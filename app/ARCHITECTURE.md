# Архитектура Frontend

Проект переведён на `Next.js App Router` и деплоится как статический export на `Vercel`.

## Слои

- `src/app` — маршруты Next.js, layout и providers.
- `src/features` — доменная логика.
- `src/screens` — крупные экраны приложения.
- `src/components` — UI-блоки.
- `src/hooks` — клиентские hooks.
- `src/supabaseClient.ts` и `src/supabaseRest.ts` — доступ к Supabase.

## Главный принцип

Сложная бизнес-логика не должна жить внутри React-компонентов.

Для смет это означает:

- `Calculation Engine` в `src/features/estimates/calculationEngine.ts` считает комнаты, позиции, totals и snapshot;
- UI только собирает ввод, показывает результат и вызывает сохранение;
- сохранение в базу идёт через `src/features/estimates/saveEstimateToSupabase.ts`.

## Snapshot-модель

При сохранении сметы в базу пишется не только ссылка на товар, но и его снимок:

- `item_snapshot`
- `source_snapshot`
- `components_snapshot`

Поэтому старая смета не меняется, даже если каталог позже обновили.

## Supabase ENV

Основные переменные:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Для `Vercel` они должны быть заданы в настройках проекта.

В коде есть публичный fallback для static export, чтобы сборка не падала во время prerender, если Vercel временно не подхватил ENV. Это fallback только для публичных значений, а не для секретов.
