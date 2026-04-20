-- Quick repair for saved estimates schema cache.
-- Run this in Supabase SQL Editor if the app says:
-- "Could not find the 'client_comment' column of 'smety' in the schema cache"

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

NOTIFY pgrst, 'reload schema';
