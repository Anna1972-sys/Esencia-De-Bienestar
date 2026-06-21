ALTER TABLE public.movement_items ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.nutrition_items ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS movement_items_tags_idx ON public.movement_items USING GIN (tags);
CREATE INDEX IF NOT EXISTS nutrition_items_tags_idx ON public.nutrition_items USING GIN (tags);