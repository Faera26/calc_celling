-- SmartCeiling estimate editor access.
-- Run after supabase_estimates_rooms.sql.
--
-- Gives every approved app user (admin/manager) access to the shared company
-- estimate list. Viewers stay blocked by the approval gate.

CREATE OR REPLACE FUNCTION public.can_use_app()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('admin', 'manager');
$$;

ALTER TABLE public.smety
  ADD COLUMN IF NOT EXISTS use_common_section BOOLEAN NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Users can read own smety" ON public.smety;
DROP POLICY IF EXISTS "Users can create own smety" ON public.smety;
DROP POLICY IF EXISTS "Users can update own smety" ON public.smety;
DROP POLICY IF EXISTS "Users can delete own smety" ON public.smety;
DROP POLICY IF EXISTS "Users and admins can read smety" ON public.smety;
DROP POLICY IF EXISTS "Users and admins can create smety" ON public.smety;
DROP POLICY IF EXISTS "Users and admins can update smety" ON public.smety;
DROP POLICY IF EXISTS "Users and admins can delete smety" ON public.smety;
DROP POLICY IF EXISTS "Approved users can read company smety" ON public.smety;
DROP POLICY IF EXISTS "Approved users can create company smety" ON public.smety;
DROP POLICY IF EXISTS "Approved users can update company smety" ON public.smety;
DROP POLICY IF EXISTS "Approved users can delete company smety" ON public.smety;

CREATE POLICY "Approved users can read company smety"
  ON public.smety FOR SELECT
  TO authenticated
  USING (public.can_use_app());

CREATE POLICY "Approved users can create company smety"
  ON public.smety FOR INSERT
  TO authenticated
  WITH CHECK (public.can_use_app() AND user_id = auth.uid());

CREATE POLICY "Approved users can update company smety"
  ON public.smety FOR UPDATE
  TO authenticated
  USING (public.can_use_app())
  WITH CHECK (public.can_use_app());

CREATE POLICY "Approved users can delete company smety"
  ON public.smety FOR DELETE
  TO authenticated
  USING (public.can_use_app());

DROP POLICY IF EXISTS "Users can read own rooms" ON public.smeta_komnaty;
DROP POLICY IF EXISTS "Users can create own rooms" ON public.smeta_komnaty;
DROP POLICY IF EXISTS "Users can update own rooms" ON public.smeta_komnaty;
DROP POLICY IF EXISTS "Users can delete own rooms" ON public.smeta_komnaty;
DROP POLICY IF EXISTS "Approved users can read company rooms" ON public.smeta_komnaty;
DROP POLICY IF EXISTS "Approved users can create company rooms" ON public.smeta_komnaty;
DROP POLICY IF EXISTS "Approved users can update company rooms" ON public.smeta_komnaty;
DROP POLICY IF EXISTS "Approved users can delete company rooms" ON public.smeta_komnaty;

CREATE POLICY "Approved users can read company rooms"
  ON public.smeta_komnaty FOR SELECT
  TO authenticated
  USING (public.can_use_app());

CREATE POLICY "Approved users can create company rooms"
  ON public.smeta_komnaty FOR INSERT
  TO authenticated
  WITH CHECK (public.can_use_app());

CREATE POLICY "Approved users can update company rooms"
  ON public.smeta_komnaty FOR UPDATE
  TO authenticated
  USING (public.can_use_app())
  WITH CHECK (public.can_use_app());

CREATE POLICY "Approved users can delete company rooms"
  ON public.smeta_komnaty FOR DELETE
  TO authenticated
  USING (public.can_use_app());

DROP POLICY IF EXISTS "Users can read own smeta positions" ON public.smeta_pozicii;
DROP POLICY IF EXISTS "Users can create own smeta positions" ON public.smeta_pozicii;
DROP POLICY IF EXISTS "Users can update own smeta positions" ON public.smeta_pozicii;
DROP POLICY IF EXISTS "Users can delete own smeta positions" ON public.smeta_pozicii;
DROP POLICY IF EXISTS "Approved users can read company smeta positions" ON public.smeta_pozicii;
DROP POLICY IF EXISTS "Approved users can create company smeta positions" ON public.smeta_pozicii;
DROP POLICY IF EXISTS "Approved users can update company smeta positions" ON public.smeta_pozicii;
DROP POLICY IF EXISTS "Approved users can delete company smeta positions" ON public.smeta_pozicii;

CREATE POLICY "Approved users can read company smeta positions"
  ON public.smeta_pozicii FOR SELECT
  TO authenticated
  USING (public.can_use_app());

CREATE POLICY "Approved users can create company smeta positions"
  ON public.smeta_pozicii FOR INSERT
  TO authenticated
  WITH CHECK (public.can_use_app());

CREATE POLICY "Approved users can update company smeta positions"
  ON public.smeta_pozicii FOR UPDATE
  TO authenticated
  USING (public.can_use_app())
  WITH CHECK (public.can_use_app());

CREATE POLICY "Approved users can delete company smeta positions"
  ON public.smeta_pozicii FOR DELETE
  TO authenticated
  USING (public.can_use_app());

NOTIFY pgrst, 'reload schema';
