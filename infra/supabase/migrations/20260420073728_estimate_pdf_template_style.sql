-- SmartCeiling PDF template and color settings.
-- Run after supabase_estimates_rooms.sql.

ALTER TABLE public.smety
  ADD COLUMN IF NOT EXISTS pdf_template TEXT NOT NULL DEFAULT 'wave',
  ADD COLUMN IF NOT EXISTS pdf_accent_color TEXT NOT NULL DEFAULT '#D4146A';

UPDATE public.smety
SET pdf_template = COALESCE(NULLIF(pdf_template, ''), 'wave'),
    pdf_accent_color = COALESCE(NULLIF(pdf_accent_color, ''), '#D4146A');

NOTIFY pgrst, 'reload schema';
