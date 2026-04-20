-- =====================================================
-- SmartCeiling: Обновление схемы БД
-- =====================================================

-- 1. Добавляем поле type в таблицу products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'product';

-- 2. Проставляем type='product' всем существующим записям
UPDATE public.products SET type = 'product' WHERE type IS NULL;

-- 3. Создаем таблицу узлов (nodes)
CREATE TABLE IF NOT EXISTS public.nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  price NUMERIC DEFAULT 0,
  unit TEXT,
  image TEXT,
  description TEXT
);

-- 4. Создаем таблицу состава узлов (node_components)
CREATE TABLE IF NOT EXISTS public.node_components (
  id SERIAL PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  item_id TEXT,
  kind TEXT,
  name TEXT,
  qty NUMERIC DEFAULT 0,
  unit TEXT,
  price NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  category TEXT,
  subcategory TEXT,
  image TEXT,
  comment TEXT
);

-- 5. Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_node_components_node_id ON public.node_components(node_id);
CREATE INDEX IF NOT EXISTS idx_node_components_item_id ON public.node_components(item_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON public.products(type);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_nodes_category ON public.nodes(category);

-- 6. Отключаем RLS для новых таблиц (публичный каталог)
ALTER TABLE public.nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_components DISABLE ROW LEVEL SECURITY;

-- 7. Политики чтения и записи
CREATE POLICY "Allow public read nodes" ON public.nodes FOR SELECT USING (true);
CREATE POLICY "Allow public insert nodes" ON public.nodes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read components" ON public.node_components FOR SELECT USING (true);
CREATE POLICY "Allow public insert components" ON public.node_components FOR INSERT WITH CHECK (true);
