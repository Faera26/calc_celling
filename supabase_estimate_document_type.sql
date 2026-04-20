-- SmartCeiling PDF document mode.
-- Run after supabase_estimates_rooms.sql.

ALTER TABLE public.smety
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'preliminary';

UPDATE public.smety
SET document_type = 'preliminary'
WHERE document_type IS NULL;

NOTIFY pgrst, 'reload schema';
