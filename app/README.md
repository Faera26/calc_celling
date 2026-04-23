# Frontend SmartCeiling

Фронтенд живёт в `app/` и собран на `Next.js 15 + React 19 + MUI`.

## Команды

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Важные папки

- `src/app` — маршруты Next.js.
- `src/features/estimates` — доменное ядро смет и Calculation Engine.
- `src/screens` — крупные экраны приложения.
- `src/components` — переиспользуемые UI-блоки.
- `src/hooks` — клиентские hooks для auth, каталога, настроек и корзины.

## Где что менять

- Логику расчёта смет меняем в `src/features/estimates/calculationEngine.ts`.
- Логику корзины меняем в `src/features/cart/cartMath.ts`.
- Экран сохранения и предпросмотра сметы — `src/components/SaveEstimateDialog.tsx`.
- Редактор уже сохранённых смет — `src/screens/EstimatesPage.tsx`.

## ENV

Нужны публичные переменные:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Во время static export есть публичный fallback, поэтому сборка не падает без ENV. Но в `Vercel` эти переменные всё равно должны быть заданы явно.

## Web Vitals

В `src/app/layout.tsx` подключён `@vercel/speed-insights/next`, поэтому Vercel сможет собирать реальные метрики загрузки после нового продового трафика.

Полная инструкция по проекту находится в корневом [README.md](C:/Users/ILYA/Desktop/Приложение/README.md).
