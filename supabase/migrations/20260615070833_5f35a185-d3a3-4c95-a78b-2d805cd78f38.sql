
-- 1) Categories table (supports subcategories via parent_id self-ref)
CREATE TABLE public.resource_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  icon text,
  parent_id uuid REFERENCES public.resource_categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.resource_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.resource_categories TO authenticated;
GRANT ALL ON public.resource_categories TO service_role;

ALTER TABLE public.resource_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view categories"
  ON public.resource_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage categories"
  ON public.resource_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_resource_categories_parent ON public.resource_categories(parent_id);
CREATE INDEX idx_resource_categories_sort ON public.resource_categories(sort_order);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_resource_categories_touch
  BEFORE UPDATE ON public.resource_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Seed with the 7 existing categories (slugs match resourceCategories.ts)
INSERT INTO public.resource_categories (name, slug, icon, sort_order) VALUES
  ('Imprescindibles',       'imprescindibles', '⭐', 1),
  ('Educación nutricional', 'educacion',       '📚', 2),
  ('Alimentación saludable','alimentacion',    '🥗', 3),
  ('Pérdida de peso',       'perdida-peso',    '⚖️', 4),
  ('Mentalidad y hábitos',  'mentalidad',      '🧠', 5),
  ('Vídeos',                'videos',          '🎥', 6),
  ('Guías y recursos',      'guias',           '📄', 7);

-- 3) Extend resources with category_id, sort_order, is_pinned
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.resource_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_resources_category_id ON public.resources(category_id);
CREATE INDEX IF NOT EXISTS idx_resources_pinned_sort ON public.resources(is_pinned DESC, sort_order ASC);

-- Backfill category_id from existing text category slug
UPDATE public.resources r
SET category_id = c.id
FROM public.resource_categories c
WHERE r.category_id IS NULL AND r.category IS NOT NULL AND c.slug = r.category;
