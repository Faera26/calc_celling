-- SmartCeiling estimate item snapshot.
-- Adds an explicit snapshot of the saved catalog position so that old estimates
-- keep their original price and characteristics even after catalog updates.

ALTER TABLE public.smeta_pozicii
  ADD COLUMN IF NOT EXISTS item_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.smeta_pozicii AS positions
SET item_snapshot = jsonb_strip_nulls(
  jsonb_build_object(
    'item_type', positions.item_type,
    'item_id', positions.item_id,
    'name', positions.item_name,
    'category', positions.category,
    'subcategory', positions.subcategory,
    'unit', positions.unit,
    'image', COALESCE(positions.source_snapshot->>'image', NULL),
    'description', COALESCE(positions.source_snapshot->>'description', NULL),
    'source', COALESCE(positions.source_snapshot->>'source', NULL),
    'base_price', positions.base_price,
    'saved_price', positions.price,
    'saved_at', COALESCE(positions.created_at::text, now()::text)
  )
)
WHERE positions.item_snapshot = '{}'::jsonb
   OR positions.item_snapshot IS NULL;

-- Для старых snapshot-объектов добираем недостающие поля, если они не были записаны
-- в момент первоначального сохранения сметы.
UPDATE public.smeta_pozicii AS positions
SET source_snapshot = jsonb_strip_nulls(
  COALESCE(positions.source_snapshot, '{}'::jsonb)
  || jsonb_build_object(
    'name', COALESCE(positions.source_snapshot->>'name', positions.item_name),
    'category', COALESCE(positions.source_snapshot->>'category', positions.category),
    'subcategory', COALESCE(positions.source_snapshot->>'subcategory', positions.subcategory),
    'unit', COALESCE(positions.source_snapshot->>'unit', positions.unit),
    'base_price', COALESCE(positions.source_snapshot->'base_price', to_jsonb(positions.base_price)),
    'source', COALESCE(positions.source_snapshot->>'source', positions.item_snapshot->>'source'),
    'image', COALESCE(positions.source_snapshot->>'image', positions.item_snapshot->>'image'),
    'description', COALESCE(positions.source_snapshot->>'description', positions.item_snapshot->>'description')
  )
)
WHERE positions.source_snapshot IS NULL
   OR positions.source_snapshot = '{}'::jsonb
   OR NOT (positions.source_snapshot ? 'name')
   OR NOT (positions.source_snapshot ? 'base_price');

NOTIFY pgrst, 'reload schema';
