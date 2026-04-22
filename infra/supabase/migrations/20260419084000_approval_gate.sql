-- SmartCeiling approval gate.
-- Run this in Supabase SQL Editor after supabase_admin_roles.sql.
--
-- Access model:
--   admin   - approved, can manage catalog and users
--   manager - approved, can use catalog and estimates
--   viewer  - not approved yet; app shows "waiting for approval"
--
-- Current users keep their existing roles.
-- New users will receive role='viewer' until an admin approves them.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.profiles AS profiles
SET email = users.email
FROM auth.users AS users
WHERE profiles.id = users.id
  AND (profiles.email IS NULL OR profiles.email = '');

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'viewer';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'manager', 'viewer'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'viewer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.can_use_app()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() IN ('admin', 'manager'), false);
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id UUID, target_role TEXT DEFAULT 'manager')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can change user roles';
  END IF;

  IF target_role NOT IN ('admin', 'manager', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %', target_role;
  END IF;

  UPDATE public.profiles AS profiles
  SET role = target_role,
      updated_at = timezone('utc'::text, now())
  WHERE profiles.id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with id % not found', target_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_user(user_email TEXT, target_role TEXT DEFAULT 'manager')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can approve users';
  END IF;

  IF target_role NOT IN ('admin', 'manager', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %', target_role;
  END IF;

  UPDATE public.profiles AS profiles
  SET role = target_role,
      email = COALESCE(profiles.email, users.email),
      updated_at = timezone('utc'::text, now())
  FROM auth.users AS users
  WHERE profiles.id = users.id
    AND lower(users.email) = lower(user_email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS TABLE (
  id UUID,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT
    profiles.id,
    COALESCE(profiles.email, users.email)::TEXT AS email,
    profiles.display_name,
    profiles.avatar_url,
    profiles.role,
    profiles.created_at,
    profiles.updated_at
  FROM public.profiles AS profiles
  LEFT JOIN auth.users AS users ON users.id = profiles.id
  ORDER BY profiles.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_user(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tovary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uslugi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uzly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.komplektaciya_uzlov ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategorii ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nastroiki_kompanii ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Authenticated can read tovary" ON public.tovary;
DROP POLICY IF EXISTS "Authenticated can manage tovary" ON public.tovary;
DROP POLICY IF EXISTS "Admins can manage tovary" ON public.tovary;
DROP POLICY IF EXISTS "Approved users can read tovary" ON public.tovary;
CREATE POLICY "Approved users can read tovary"
  ON public.tovary FOR SELECT
  TO authenticated
  USING (public.can_use_app());
CREATE POLICY "Admins can manage tovary"
  ON public.tovary FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can read uslugi" ON public.uslugi;
DROP POLICY IF EXISTS "Authenticated can manage uslugi" ON public.uslugi;
DROP POLICY IF EXISTS "Admins can manage uslugi" ON public.uslugi;
DROP POLICY IF EXISTS "Approved users can read uslugi" ON public.uslugi;
CREATE POLICY "Approved users can read uslugi"
  ON public.uslugi FOR SELECT
  TO authenticated
  USING (public.can_use_app());
CREATE POLICY "Admins can manage uslugi"
  ON public.uslugi FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can read uzly" ON public.uzly;
DROP POLICY IF EXISTS "Authenticated can manage uzly" ON public.uzly;
DROP POLICY IF EXISTS "Admins can manage uzly" ON public.uzly;
DROP POLICY IF EXISTS "Approved users can read uzly" ON public.uzly;
CREATE POLICY "Approved users can read uzly"
  ON public.uzly FOR SELECT
  TO authenticated
  USING (public.can_use_app());
CREATE POLICY "Admins can manage uzly"
  ON public.uzly FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can read komplektaciya_uzlov" ON public.komplektaciya_uzlov;
DROP POLICY IF EXISTS "Authenticated can manage komplektaciya_uzlov" ON public.komplektaciya_uzlov;
DROP POLICY IF EXISTS "Admins can manage komplektaciya_uzlov" ON public.komplektaciya_uzlov;
DROP POLICY IF EXISTS "Approved users can read komplektaciya_uzlov" ON public.komplektaciya_uzlov;
CREATE POLICY "Approved users can read komplektaciya_uzlov"
  ON public.komplektaciya_uzlov FOR SELECT
  TO authenticated
  USING (public.can_use_app());
CREATE POLICY "Admins can manage komplektaciya_uzlov"
  ON public.komplektaciya_uzlov FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can read kategorii" ON public.kategorii;
DROP POLICY IF EXISTS "Authenticated can manage kategorii" ON public.kategorii;
DROP POLICY IF EXISTS "Admins can manage kategorii" ON public.kategorii;
DROP POLICY IF EXISTS "Approved users can read kategorii" ON public.kategorii;
CREATE POLICY "Approved users can read kategorii"
  ON public.kategorii FOR SELECT
  TO authenticated
  USING (public.can_use_app());
CREATE POLICY "Admins can manage kategorii"
  ON public.kategorii FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated can read nastroiki_kompanii" ON public.nastroiki_kompanii;
DROP POLICY IF EXISTS "Authenticated can manage nastroiki_kompanii" ON public.nastroiki_kompanii;
DROP POLICY IF EXISTS "Admins can manage nastroiki_kompanii" ON public.nastroiki_kompanii;
DROP POLICY IF EXISTS "Approved users can read nastroiki_kompanii" ON public.nastroiki_kompanii;
CREATE POLICY "Approved users can read nastroiki_kompanii"
  ON public.nastroiki_kompanii FOR SELECT
  TO authenticated
  USING (public.can_use_app());
CREATE POLICY "Admins can manage nastroiki_kompanii"
  ON public.nastroiki_kompanii FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Manual approval examples:
-- SELECT public.approve_user('manager@example.com', 'manager');
-- SELECT public.approve_user('admin@example.com', 'admin');
-- SELECT public.approve_user('blocked@example.com', 'viewer');
