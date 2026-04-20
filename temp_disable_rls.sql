-- Временно отключаем RLS для заливки данных скриптом (от имени анонима)
ALTER TABLE public.tovary DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uslugi DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uzly DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.komplektaciya_uzlov DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategorii DISABLE ROW LEVEL SECURITY;
