-- SmartCeiling admin model.
-- Run this in Supabase SQL Editor.
--
-- Roles:
--   admin   - can read and edit catalog, users, settings, estimates
--   manager - can read catalog and create estimates
--   viewer  - read-only catalog access
--
-- This migration makes all currently existing auth users admins so you do not lose access.
-- New users receive role='manager' by default.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'manager';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'manager', 'viewer'));

INSERT INTO public.profiles (id, display_name, role)
SELECT
  users.id,
  COALESCE(users.raw_user_meta_data->>'display_name', users.email),
  'admin'
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET role = 'admin';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'manager'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = 'admin', false);
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_tovary_updated_at ON public.tovary;
CREATE TRIGGER set_tovary_updated_at
  BEFORE UPDATE ON public.tovary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_uslugi_updated_at ON public.uslugi;
CREATE TRIGGER set_uslugi_updated_at
  BEFORE UPDATE ON public.uslugi
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_uzly_updated_at ON public.uzly;
CREATE TRIGGER set_uzly_updated_at
  BEFORE UPDATE ON public.uzly
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_smety_updated_at ON public.smety;
CREATE TRIGGER set_smety_updated_at
  BEFORE UPDATE ON public.smety
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Catalog policies: all authenticated roles can read; only admin can modify.
DROP POLICY IF EXISTS "Authenticated can manage tovary" ON public.tovary;
DROP POLICY IF EXISTS "Admins can manage tovary" ON public.tovary;
CREATE POLICY "Admins can manage tovary"
  ON public.tovary FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can manage uslugi" ON public.uslugi;
DROP POLICY IF EXISTS "Admins can manage uslugi" ON public.uslugi;
CREATE POLICY "Admins can manage uslugi"
  ON public.uslugi FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can manage uzly" ON public.uzly;
DROP POLICY IF EXISTS "Admins can manage uzly" ON public.uzly;
CREATE POLICY "Admins can manage uzly"
  ON public.uzly FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can manage komplektaciya_uzlov" ON public.komplektaciya_uzlov;
DROP POLICY IF EXISTS "Admins can manage komplektaciya_uzlov" ON public.komplektaciya_uzlov;
CREATE POLICY "Admins can manage komplektaciya_uzlov"
  ON public.komplektaciya_uzlov FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can manage kategorii" ON public.kategorii;
DROP POLICY IF EXISTS "Admins can manage kategorii" ON public.kategorii;
CREATE POLICY "Admins can manage kategorii"
  ON public.kategorii FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can manage nastroiki_kompanii" ON public.nastroiki_kompanii;
DROP POLICY IF EXISTS "Admins can manage nastroiki_kompanii" ON public.nastroiki_kompanii;
CREATE POLICY "Admins can manage nastroiki_kompanii"
  ON public.nastroiki_kompanii FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Profiles: user reads own profile; admins read and manage everyone.
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users and admins can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users and admins can update profiles" ON public.profiles;

CREATE POLICY "Users and admins can read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users and admins can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      id = auth.uid()
      AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Handy view for checking the active user role from the client.
CREATE OR REPLACE VIEW public.my_profile AS
SELECT id, display_name, avatar_url, role, created_at, updated_at
FROM public.profiles
WHERE id = auth.uid();

GRANT SELECT ON public.my_profile TO authenticated;
