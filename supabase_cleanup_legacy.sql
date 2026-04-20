-- SmartCeiling cleanup after the first experimental import.
-- Run this once in Supabase SQL Editor.
--
-- What remains after this:
--   tovary                - products/goods only
--   uslugi                - services/work only
--   uzly                  - reusable assemblies
--   komplektaciya_uzlov   - internal positions of each assembly
--   kategorii             - category tree for filters
--   nastroiki_kompanii    - company/PDF/margin settings
--   profiles, smety, smeta_pozicii - user accounts and saved estimates

BEGIN;

-- Rename the unclear table name to the clearer one.
DO $$
BEGIN
  IF to_regclass('public.komplektaciya_uzlov') IS NULL
     AND to_regclass('public.sostav_uzlov') IS NOT NULL THEN
    ALTER TABLE public.sostav_uzlov RENAME TO komplektaciya_uzlov;
  END IF;
END $$;

-- If both tables ever existed, keep the clear table and remove the old duplicate.
DROP TABLE IF EXISTS public.sostav_uzlov CASCADE;

-- Old experimental tables. Their data has been re-imported into tovary/uslugi/uzly/komplektaciya_uzlov.
DROP TABLE IF EXISTS public.node_components CASCADE;
DROP TABLE IF EXISTS public.nodes CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;

-- Old first-draft estimates table. New estimate data model is smety + smeta_pozicii.
DROP TABLE IF EXISTS public.estimates CASCADE;

CREATE INDEX IF NOT EXISTS idx_komplektaciya_uzlov_uzel_id ON public.komplektaciya_uzlov(uzel_id);
CREATE INDEX IF NOT EXISTS idx_komplektaciya_uzlov_item ON public.komplektaciya_uzlov(item_type, item_id);

ALTER TABLE public.komplektaciya_uzlov DISABLE ROW LEVEL SECURITY;

COMMIT;
