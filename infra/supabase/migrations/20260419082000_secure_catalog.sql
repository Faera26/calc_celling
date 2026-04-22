-- SmartCeiling security policies.
-- Run this after supabase_cleanup_legacy.sql.
--
-- Result:
--   Anonymous visitors cannot read the assortment.
--   Logged-in users can read and manage catalog data.
--   Later we can tighten writes to admins only through profiles.role.

ALTER TABLE public.tovary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uslugi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uzly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.komplektaciya_uzlov ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategorii ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nastroiki_kompanii ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read tovary" ON public.tovary;
DROP POLICY IF EXISTS "Authenticated can manage tovary" ON public.tovary;
DROP POLICY IF EXISTS "Authenticated can read uslugi" ON public.uslugi;
DROP POLICY IF EXISTS "Authenticated can manage uslugi" ON public.uslugi;
DROP POLICY IF EXISTS "Authenticated can read uzly" ON public.uzly;
DROP POLICY IF EXISTS "Authenticated can manage uzly" ON public.uzly;
DROP POLICY IF EXISTS "Authenticated can read komplektaciya_uzlov" ON public.komplektaciya_uzlov;
DROP POLICY IF EXISTS "Authenticated can manage komplektaciya_uzlov" ON public.komplektaciya_uzlov;
DROP POLICY IF EXISTS "Authenticated can read kategorii" ON public.kategorii;
DROP POLICY IF EXISTS "Authenticated can manage kategorii" ON public.kategorii;
DROP POLICY IF EXISTS "Authenticated can read nastroiki_kompanii" ON public.nastroiki_kompanii;
DROP POLICY IF EXISTS "Authenticated can manage nastroiki_kompanii" ON public.nastroiki_kompanii;

CREATE POLICY "Authenticated can read tovary"
  ON public.tovary FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can manage tovary"
  ON public.tovary FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can read uslugi"
  ON public.uslugi FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can manage uslugi"
  ON public.uslugi FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can read uzly"
  ON public.uzly FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can manage uzly"
  ON public.uzly FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can read komplektaciya_uzlov"
  ON public.komplektaciya_uzlov FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can manage komplektaciya_uzlov"
  ON public.komplektaciya_uzlov FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can read kategorii"
  ON public.kategorii FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can manage kategorii"
  ON public.kategorii FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can read nastroiki_kompanii"
  ON public.nastroiki_kompanii FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can manage nastroiki_kompanii"
  ON public.nastroiki_kompanii FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
