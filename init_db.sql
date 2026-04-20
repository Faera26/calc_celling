-- 1. Создаем таблицу для товаров
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  price NUMERIC DEFAULT 0,
  unit TEXT,
  image TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Включаем политику безопасности (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 3. Разрешаем всем читать товары (Public Read Access)
CREATE POLICY "Allow public read access" ON public.products
  FOR SELECT USING (true);

-- 4. Создаем таблицу для корзин/смет (на будущее)
CREATE TABLE IF NOT EXISTS public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  total_price NUMERIC DEFAULT 0,
  items JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own estimates" ON public.estimates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own estimates" ON public.estimates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
