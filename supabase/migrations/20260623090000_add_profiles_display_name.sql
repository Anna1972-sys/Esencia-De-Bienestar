-- Keeps older Supabase projects compatible with the profile shape used by the app.
-- IF NOT EXISTS makes this safe for projects where the column is already present.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;
