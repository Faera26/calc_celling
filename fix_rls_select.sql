-- Fix missing SELECT policies for the catalog tables
-- Run this in the Supabase SQL Editor

-- 1. Tovary
DROP POLICY IF EXISTS "Authenticated can read tovary" ON public.tovary;
CREATE POLICY "Authenticated can read tovary"
  ON public.tovary FOR SELECT
  TO authenticated
  USING (true);

-- 2. Uslugi
DROP POLICY IF EXISTS "Authenticated can read uslugi" ON public.uslugi;
CREATE POLICY "Authenticated can read uslugi"
  ON public.uslugi FOR SELECT
  TO authenticated
  USING (true);

-- 3. Uzly
DROP POLICY IF EXISTS "Authenticated can read uzly" ON public.uzly;
CREATE POLICY "Authenticated can read uzly"
  ON public.uzly FOR SELECT
  TO authenticated
  USING (true);

-- 4. Komplektaciya
DROP POLICY IF EXISTS "Authenticated can read komplektaciya_uzlov" ON public.komplektaciya_uzlov;
CREATE POLICY "Authenticated can read komplektaciya_uzlov"
  ON public.komplektaciya_uzlov FOR SELECT
  TO authenticated
  USING (true);

-- 5. Kategorii
DROP POLICY IF EXISTS "Authenticated can read kategorii" ON public.kategorii;
CREATE POLICY "Authenticated can read kategorii"
  ON public.kategorii FOR SELECT
  TO authenticated
  USING (true);

-- 6. Nastroiki (so settings can be loaded)
DROP POLICY IF EXISTS "Authenticated can read nastroiki_kompanii" ON public.nastroiki_kompanii;
CREATE POLICY "Authenticated can read nastroiki_kompanii"
  ON public.nastroiki_kompanii FOR SELECT
  TO authenticated
  USING (true);
