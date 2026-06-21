
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
