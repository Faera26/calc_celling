-- SmartCeiling saved estimates.
-- Run this in Supabase SQL Editor after supabase_approval_gate.sql.
--
-- Adds:
--   smety client/object fields and counters
--   smeta_komnaty for room-based calculator input
--   smeta_pozicii component snapshots for node breakdowns in saved estimates
-- Then run supabase_estimate_editor_access.sql for company-wide estimate access.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

ALTER TABLE public.smety
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS object_address TEXT,
  ADD COLUMN IF NOT EXISTS client_comment TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'preliminary',
  ADD COLUMN IF NOT EXISTS pdf_template TEXT NOT NULL DEFAULT 'wave',
  ADD COLUMN IF NOT EXISTS pdf_accent_color TEXT NOT NULL DEFAULT '#D4146A',
  ADD COLUMN IF NOT EXISTS use_common_section BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS room_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS components_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.smeta_komnaty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smeta_id UUID NOT NULL REFERENCES public.smety(id) ON DELETE CASCADE,
  position_index INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  area NUMERIC NOT NULL DEFAULT 0,
  perimeter NUMERIC NOT NULL DEFAULT 0,
  corners INTEGER NOT NULL DEFAULT 0,
  light_points INTEGER NOT NULL DEFAULT 0,
  pipes INTEGER NOT NULL DEFAULT 0,
  curtain_tracks NUMERIC NOT NULL DEFAULT 0,
  niches NUMERIC NOT NULL DEFAULT 0,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.smeta_pozicii
  ADD COLUMN IF NOT EXISTS position_index INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS room_id UUID,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS base_price NUMERIC,
  ADD COLUMN IF NOT EXISTS components_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'smeta_pozicii_room_id_fkey'
  ) THEN
    ALTER TABLE public.smeta_pozicii
      ADD CONSTRAINT smeta_pozicii_room_id_fkey
      FOREIGN KEY (room_id) REFERENCES public.smeta_komnaty(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_smety_user_created ON public.smety(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smeta_komnaty_smeta_id ON public.smeta_komnaty(smeta_id, position_index);
CREATE INDEX IF NOT EXISTS idx_smeta_pozicii_room_id ON public.smeta_pozicii(room_id);

DROP TRIGGER IF EXISTS set_smeta_komnaty_updated_at ON public.smeta_komnaty;
CREATE TRIGGER set_smeta_komnaty_updated_at
  BEFORE UPDATE ON public.smeta_komnaty
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.smety ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smeta_komnaty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smeta_pozicii ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own smety" ON public.smety;
DROP POLICY IF EXISTS "Users can create own smety" ON public.smety;
DROP POLICY IF EXISTS "Users can update own smety" ON public.smety;
DROP POLICY IF EXISTS "Users can delete own smety" ON public.smety;
DROP POLICY IF EXISTS "Users and admins can read smety" ON public.smety;
DROP POLICY IF EXISTS "Users and admins can create smety" ON public.smety;
DROP POLICY IF EXISTS "Users and admins can update smety" ON public.smety;
DROP POLICY IF EXISTS "Users and admins can delete smety" ON public.smety;

CREATE POLICY "Users and admins can read smety"
  ON public.smety FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users and admins can create smety"
  ON public.smety FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users and admins can update smety"
  ON public.smety FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users and admins can delete smety"
  ON public.smety FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can read own rooms" ON public.smeta_komnaty;
DROP POLICY IF EXISTS "Users can create own rooms" ON public.smeta_komnaty;
DROP POLICY IF EXISTS "Users can update own rooms" ON public.smeta_komnaty;
DROP POLICY IF EXISTS "Users can delete own rooms" ON public.smeta_komnaty;

CREATE POLICY "Users can read own rooms"
  ON public.smeta_komnaty FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_komnaty.smeta_id
        AND (smety.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Users can create own rooms"
  ON public.smeta_komnaty FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_komnaty.smeta_id
        AND (smety.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Users can update own rooms"
  ON public.smeta_komnaty FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_komnaty.smeta_id
        AND (smety.user_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_komnaty.smeta_id
        AND (smety.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Users can delete own rooms"
  ON public.smeta_komnaty FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_komnaty.smeta_id
        AND (smety.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Users can read own smeta positions" ON public.smeta_pozicii;
DROP POLICY IF EXISTS "Users can create own smeta positions" ON public.smeta_pozicii;
DROP POLICY IF EXISTS "Users can update own smeta positions" ON public.smeta_pozicii;
DROP POLICY IF EXISTS "Users can delete own smeta positions" ON public.smeta_pozicii;

CREATE POLICY "Users can read own smeta positions"
  ON public.smeta_pozicii FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_pozicii.smeta_id
        AND (smety.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Users can create own smeta positions"
  ON public.smeta_pozicii FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_pozicii.smeta_id
        AND (smety.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Users can update own smeta positions"
  ON public.smeta_pozicii FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_pozicii.smeta_id
        AND (smety.user_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_pozicii.smeta_id
        AND (smety.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Users can delete own smeta positions"
  ON public.smeta_pozicii FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_pozicii.smeta_id
        AND (smety.user_id = auth.uid() OR public.is_admin())
    )
  );

NOTIFY pgrst, 'reload schema';
