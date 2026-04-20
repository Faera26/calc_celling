-- Включаем RLS обратно после завершения заливки
ALTER TABLE public.tovary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uslugi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uzly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.komplektaciya_uzlov ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategorii ENABLE ROW LEVEL SECURITY;
