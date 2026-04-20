-- Run this after you register/login at least once.
-- It promotes every existing Supabase Auth user to admin.
-- For a single-user app during development this is the easiest safe reset.

INSERT INTO public.profiles (id, display_name, role)
SELECT
  users.id,
  COALESCE(users.raw_user_meta_data->>'display_name', users.email),
  'admin'
FROM auth.users AS users
ON CONFLICT (id) DO UPDATE
SET
  display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
  role = 'admin',
  updated_at = timezone('utc'::text, now());
