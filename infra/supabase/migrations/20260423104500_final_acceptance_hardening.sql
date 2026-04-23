-- SmartCeiling final acceptance hardening.
-- 1. Fixes mutable search_path warning for set_updated_at().
-- 2. Removes unused my_profile view that triggers security_definer_view advisor.
-- 3. Tightens catalog/settings policies to approved authenticated users only.
-- 4. Splits admin write access into INSERT/UPDATE/DELETE to avoid duplicate SELECT policies.
-- 5. Optimizes profiles RLS and removes duplicate indexes.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP VIEW IF EXISTS public.my_profile;

DROP POLICY IF EXISTS "Users and admins can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users and admins can update profiles" ON public.profiles;

CREATE POLICY "Users and admins can read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

CREATE POLICY "Users and admins can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR (
      id = (SELECT auth.uid())
      AND role = (
        SELECT profiles.role
        FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated can read tovary" ON public.tovary;
DROP POLICY IF EXISTS "Approved users can read tovary" ON public.tovary;
DROP POLICY IF EXISTS "Admins can manage tovary" ON public.tovary;
DROP POLICY IF EXISTS "Admins can insert tovary" ON public.tovary;
DROP POLICY IF EXISTS "Admins can update tovary" ON public.tovary;
DROP POLICY IF EXISTS "Admins can delete tovary" ON public.tovary;

CREATE POLICY "Approved users can read tovary"
  ON public.tovary FOR SELECT
  TO authenticated
  USING ((SELECT public.can_use_app()));

CREATE POLICY "Admins can insert tovary"
  ON public.tovary FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update tovary"
  ON public.tovary FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete tovary"
  ON public.tovary FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated can read uslugi" ON public.uslugi;
DROP POLICY IF EXISTS "Approved users can read uslugi" ON public.uslugi;
DROP POLICY IF EXISTS "Admins can manage uslugi" ON public.uslugi;
DROP POLICY IF EXISTS "Admins can insert uslugi" ON public.uslugi;
DROP POLICY IF EXISTS "Admins can update uslugi" ON public.uslugi;
DROP POLICY IF EXISTS "Admins can delete uslugi" ON public.uslugi;

CREATE POLICY "Approved users can read uslugi"
  ON public.uslugi FOR SELECT
  TO authenticated
  USING ((SELECT public.can_use_app()));

CREATE POLICY "Admins can insert uslugi"
  ON public.uslugi FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update uslugi"
  ON public.uslugi FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete uslugi"
  ON public.uslugi FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated can read uzly" ON public.uzly;
DROP POLICY IF EXISTS "Approved users can read uzly" ON public.uzly;
DROP POLICY IF EXISTS "Admins can manage uzly" ON public.uzly;
DROP POLICY IF EXISTS "Admins can insert uzly" ON public.uzly;
DROP POLICY IF EXISTS "Admins can update uzly" ON public.uzly;
DROP POLICY IF EXISTS "Admins can delete uzly" ON public.uzly;

CREATE POLICY "Approved users can read uzly"
  ON public.uzly FOR SELECT
  TO authenticated
  USING ((SELECT public.can_use_app()));

CREATE POLICY "Admins can insert uzly"
  ON public.uzly FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update uzly"
  ON public.uzly FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete uzly"
  ON public.uzly FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated can read komplektaciya_uzlov" ON public.komplektaciya_uzlov;
DROP POLICY IF EXISTS "Approved users can read komplektaciya_uzlov" ON public.komplektaciya_uzlov;
DROP POLICY IF EXISTS "Admins can manage komplektaciya_uzlov" ON public.komplektaciya_uzlov;
DROP POLICY IF EXISTS "Admins can insert komplektaciya_uzlov" ON public.komplektaciya_uzlov;
DROP POLICY IF EXISTS "Admins can update komplektaciya_uzlov" ON public.komplektaciya_uzlov;
DROP POLICY IF EXISTS "Admins can delete komplektaciya_uzlov" ON public.komplektaciya_uzlov;

CREATE POLICY "Approved users can read komplektaciya_uzlov"
  ON public.komplektaciya_uzlov FOR SELECT
  TO authenticated
  USING ((SELECT public.can_use_app()));

CREATE POLICY "Admins can insert komplektaciya_uzlov"
  ON public.komplektaciya_uzlov FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update komplektaciya_uzlov"
  ON public.komplektaciya_uzlov FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete komplektaciya_uzlov"
  ON public.komplektaciya_uzlov FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated can read kategorii" ON public.kategorii;
DROP POLICY IF EXISTS "Approved users can read kategorii" ON public.kategorii;
DROP POLICY IF EXISTS "Admins can manage kategorii" ON public.kategorii;
DROP POLICY IF EXISTS "Admins can insert kategorii" ON public.kategorii;
DROP POLICY IF EXISTS "Admins can update kategorii" ON public.kategorii;
DROP POLICY IF EXISTS "Admins can delete kategorii" ON public.kategorii;

CREATE POLICY "Approved users can read kategorii"
  ON public.kategorii FOR SELECT
  TO authenticated
  USING ((SELECT public.can_use_app()));

CREATE POLICY "Admins can insert kategorii"
  ON public.kategorii FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update kategorii"
  ON public.kategorii FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete kategorii"
  ON public.kategorii FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated can read nastroiki_kompanii" ON public.nastroiki_kompanii;
DROP POLICY IF EXISTS "Approved users can read nastroiki_kompanii" ON public.nastroiki_kompanii;
DROP POLICY IF EXISTS "Admins can manage nastroiki_kompanii" ON public.nastroiki_kompanii;
DROP POLICY IF EXISTS "Admins can insert nastroiki_kompanii" ON public.nastroiki_kompanii;
DROP POLICY IF EXISTS "Admins can update nastroiki_kompanii" ON public.nastroiki_kompanii;
DROP POLICY IF EXISTS "Admins can delete nastroiki_kompanii" ON public.nastroiki_kompanii;

CREATE POLICY "Approved users can read nastroiki_kompanii"
  ON public.nastroiki_kompanii FOR SELECT
  TO authenticated
  USING ((SELECT public.can_use_app()));

CREATE POLICY "Admins can insert nastroiki_kompanii"
  ON public.nastroiki_kompanii FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update nastroiki_kompanii"
  ON public.nastroiki_kompanii FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete nastroiki_kompanii"
  ON public.nastroiki_kompanii FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP INDEX IF EXISTS public.idx_sostav_uzlov_item;
DROP INDEX IF EXISTS public.idx_sostav_uzlov_uzel_id;

NOTIFY pgrst, 'reload schema';
