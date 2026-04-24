# SmartCeiling Calc

Калькулятор натяжных потолков на `Next.js + Supabase + Vercel`.

Прод-ссылка: [calccelling.vercel.app](https://calccelling.vercel.app)

## Что умеет проект

- каталог товаров, услуг и узлов;
- корзина и сохранение смет;
- Calculation Engine для расчёта комнат, площади, периметра и автоправил;
- snapshot-модель смет, чтобы старые сметы не ломались после обновления каталога;
- редактор сохранённых смет с ручными правками;
- роли `admin / manager / viewer`.

## Структура репозитория

- `app/` — фронтенд на Next.js.
- `infra/supabase/migrations/` — SQL-миграции базы.
- `infra/supabase/README.md` — заметки по базе.

## Быстрый старт

```bash
cd app
npm install
npm run dev
```

Локально сайт откроется на [http://localhost:3000](http://localhost:3000) или на ближайшем свободном порту.

## ENV

Нужны две публичные переменные:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Пример лежит в `app/.env.example`.

Важно:

- в коде есть публичный fallback для static export, чтобы сборка на Vercel не падала;
- в проде эти ENV всё равно нужно хранить в настройках проекта Vercel явно.

## Как устроен расчёт

Главный модуль расчёта:

- `app/src/features/estimates/calculationEngine.ts`

Он отвечает за:

- нормализацию комнат;
- сводку по площади, периметру, углам, свету, трубам, карнизам и нишам;
- автодобавление позиций по правилам;
- итоговые позиции сметы;
- payload для Supabase;
- snapshot данных для PDF и базы.

Логика такая:

1. UI собирает ввод пользователя.
2. `calculateEstimate(...)` превращает его в нормализованную смету.
3. `buildEstimateRecordPayloads(...)` и `buildEstimatePersistenceRows(...)` готовят строки для базы.
4. `saveEstimateToSupabase(...)` сохраняет смету.

UI не должен сам считать площадь, периметр, totals или snapshot-данные сметы.

## Как работает Snapshot

При сохранении сметы в `smeta_pozicii` записываются:

- текущая цена;
- базовая цена;
- название позиции;
- категория и подкатегория;
- единица измерения;
- описание и картинка;
- источник позиции;
- состав узла, если это узел.

Это хранится в полях:

- `item_snapshot`
- `source_snapshot`
- `components_snapshot`

Зачем это нужно:

- если завтра поменяется цена в каталоге, старая смета всё равно останется такой, какой была в момент сохранения;
- PDF и редактор смет не зависят от “живого” каталога.

## Как обновить цены

Если нужно поменять цену существующего материала:

1. Зайди в админку.
2. Найди товар или услугу.
3. Измени `price`.
4. Сохрани.

Что произойдёт:

- новые сметы будут считать по новой цене;
- старые сметы сохранят старую цену внутри snapshot.

## Как пересобрать каталог из HTML

Исходники импорта лежат в `html (данные)/`:

- `tolko tovari.html` — только товары;
- `uzli_tovari_uslugi.html` — узлы и услуги;
- `catalog-logical-classification.md` — логичная раскладка категорий.

Команда пересборки:

```bash
python scripts/apply_catalog_classification.py
```

Она обновляет `app/src/data/normalized_catalog.json` и генерирует SQL-миграцию в `infra/supabase/migrations/`. После этого миграцию нужно применить в Supabase, чтобы живой каталог получил те же категории.

## Как добавить новый тип полотна

Самый простой путь:

1. В админке открой раздел товаров.
2. Добавь новый товар.
3. Укажи:
   - `name`
   - `category`
   - `subcategory`
   - `price`
   - `unit` обычно `м²`
4. Сохрани.

Чтобы автоправило выбирало именно этот тип полотна:

1. При сохранении сметы открой блок умных правил.
2. Найди правило полотна.
3. Выбери конкретный товар из каталога.

Если нужно новое системное правило расчёта, его добавляют в:

- `app/src/features/estimates/calculationEngine.ts`
- тип `EstimateCalculationRule` в `app/src/types.ts`

## Как добавить новый умный расчёт

Пример: считать отдельную услугу по количеству светильников.

Порядок:

1. Добавить правило в `createDefaultCalculationRules()`.
2. Выбрать метрику:
   - `area`
   - `perimeter`
   - `corners`
   - `light_points`
   - `pipes`
   - `curtain_tracks`
   - `niches`
   - `fixed`
3. Указать товар или услугу для правила.
4. Проверить тестами `estimateMath.test.ts`.

## База данных

Основные таблицы:

- `smety` — шапка сметы;
- `smeta_komnaty` — комнаты;
- `smeta_pozicii` — позиции сметы;
- `tovary`, `uslugi`, `uzly` — каталог;
- `komplektaciya_uzlov` — состав узлов;
- `profiles` — роли пользователей.

Все изменения схемы добавляем только через:

- `infra/supabase/migrations/`

## Деплой

Связка:

- `GitHub` — код и история;
- `Vercel` — сборка и хостинг;
- `Supabase` — БД, auth и storage.

Сейчас проект деплоится из корня репозитория, а build идёт в `app/`.

Полезные файлы:

- `vercel.json`
- `package.json`
- `app/package.json`

## Web Vitals

В layout уже подключён `@vercel/speed-insights`, поэтому после новых визитов на проде в Vercel будут собираться реальные полевые метрики:

- `LCP`
- `CLS`
- `INP`
- и связанные Speed Insights показатели

Это лучший способ смотреть производительность для живого проекта, чем ориентироваться только на один лабораторный запуск.

## Проверки перед релизом

```bash
cd app
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

## Что трогать осторожно

- `app/src/supabaseClient.ts` — публичный клиент Supabase;
- `app/src/supabaseRest.ts` — REST-обёртка для статического export;
- `infra/supabase/migrations/` — любая ошибка тут влияет на продовую базу;
- `app/src/features/estimates/calculationEngine.ts` — это сердце логики смет.

## Для новичка

Если коротко, где чаще всего будет работа:

- хочешь поменять внешний вид — иди в `app/src/components` и `app/src/screens`;
- хочешь поменять расчёт — иди в `app/src/features/estimates/calculationEngine.ts`;
- хочешь поменять каталог или роли — смотри `AdminPage.tsx` и SQL-миграции;
- хочешь проверить, что ничего не сломал — запускай `lint`, `typecheck`, `test`, `build`.

Если сомневаешься, сначала меняй маленький кусок и сразу гоняй проверки.
