-- Diagnostic for saved estimates schema.
-- Run this in Supabase SQL Editor and check that every expected column says "yes".

SELECT
  expected.column_name,
  CASE WHEN columns.column_name IS NULL THEN 'NO' ELSE 'yes' END AS exists_in_database
FROM (
  VALUES
    ('title'),
    ('client_email'),
    ('object_address'),
    ('client_comment'),
    ('room_count'),
    ('items_count'),
    ('components_count'),
    ('settings_snapshot')
) AS expected(column_name)
LEFT JOIN information_schema.columns AS columns
  ON columns.table_schema = 'public'
 AND columns.table_name = 'smety'
 AND columns.column_name = expected.column_name
ORDER BY expected.column_name;

SELECT
  to_regclass('public.smeta_komnaty') AS smeta_komnaty_table,
  to_regclass('public.smeta_pozicii') AS smeta_pozicii_table;

SELECT
  expected.column_name,
  CASE WHEN columns.column_name IS NULL THEN 'NO' ELSE 'yes' END AS exists_in_database
FROM (
  VALUES
    ('position_index'),
    ('room_id'),
    ('category'),
    ('subcategory'),
    ('base_price'),
    ('components_snapshot'),
    ('source_snapshot')
) AS expected(column_name)
LEFT JOIN information_schema.columns AS columns
  ON columns.table_schema = 'public'
 AND columns.table_name = 'smeta_pozicii'
 AND columns.column_name = expected.column_name
ORDER BY expected.column_name;

NOTIFY pgrst, 'reload schema';
