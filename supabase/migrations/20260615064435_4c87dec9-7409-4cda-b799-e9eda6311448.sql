
ALTER TABLE public.recipes 
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_user_id uuid;

ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_visibility_check;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_visibility_check CHECK (visibility IN ('private','community','featured'));

DROP POLICY IF EXISTS recipes_library_read ON public.recipes;
CREATE POLICY recipes_library_read ON public.recipes
  FOR SELECT TO authenticated
  USING (is_library = true OR visibility IN ('community','featured'));
