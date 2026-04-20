-- SmartCeiling: readable catalog schema
-- Run this file in Supabase SQL Editor before running seed_human_catalog.js.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tovary (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Без категории',
  subcategory TEXT NOT NULL DEFAULT 'Без подкатегории',
  price NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  image TEXT,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'catalog',
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.uslugi (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Без категории',
  subcategory TEXT NOT NULL DEFAULT 'Без подкатегории',
  price NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  image TEXT,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'catalog',
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.uzly (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Без категории',
  subcategory TEXT NOT NULL DEFAULT 'Без подкатегории',
  price NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  image TEXT,
  description TEXT,
  stats JSONB,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.komplektaciya_uzlov (
  id TEXT PRIMARY KEY,
  uzel_id TEXT NOT NULL REFERENCES public.uzly(id) ON DELETE CASCADE,
  position_index INTEGER NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('tovar', 'usluga')),
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  subcategory TEXT,
  image TEXT,
  comment TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (uzel_id, position_index)
);

CREATE TABLE IF NOT EXISTS public.kategorii (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('tovar', 'usluga', 'uzel')),
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  items_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.nastroiki_kompanii (
  id TEXT PRIMARY KEY DEFAULT 'default',
  company_name TEXT DEFAULT 'SmartCeiling',
  manager_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  avatar_url TEXT,
  default_margin_percent NUMERIC NOT NULL DEFAULT 0,
  default_discount_percent NUMERIC NOT NULL DEFAULT 0,
  pdf_note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.smety (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name TEXT,
  client_phone TEXT,
  margin_percent NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.smeta_pozicii (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smeta_id UUID NOT NULL REFERENCES public.smety(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('tovar', 'usluga', 'uzel')),
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tovary_category ON public.tovary(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_uslugi_category ON public.uslugi(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_uzly_category ON public.uzly(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_komplektaciya_uzlov_uzel_id ON public.komplektaciya_uzlov(uzel_id);
CREATE INDEX IF NOT EXISTS idx_komplektaciya_uzlov_item ON public.komplektaciya_uzlov(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_kategorii_entity ON public.kategorii(entity_type, category, subcategory);
CREATE INDEX IF NOT EXISTS idx_smeta_pozicii_smeta_id ON public.smeta_pozicii(smeta_id);

-- Catalog tables are readable and seedable by the app key while the project is being built.
-- Later, when admin authorization is ready, writes should move behind authenticated policies.
ALTER TABLE public.tovary DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uslugi DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uzly DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.komplektaciya_uzlov DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategorii DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nastroiki_kompanii DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smety ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smeta_pozicii ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own smety" ON public.smety;
DROP POLICY IF EXISTS "Users can create own smety" ON public.smety;
DROP POLICY IF EXISTS "Users can update own smety" ON public.smety;
DROP POLICY IF EXISTS "Users can read own smeta positions" ON public.smeta_pozicii;
DROP POLICY IF EXISTS "Users can create own smeta positions" ON public.smeta_pozicii;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own smety"
  ON public.smety FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own smety"
  ON public.smety FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own smety"
  ON public.smety FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own smeta positions"
  ON public.smeta_pozicii FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_pozicii.smeta_id
        AND smety.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own smeta positions"
  ON public.smeta_pozicii FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.smety
      WHERE smety.id = smeta_pozicii.smeta_id
        AND smety.user_id = auth.uid()
    )
  );

INSERT INTO public.nastroiki_kompanii (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
