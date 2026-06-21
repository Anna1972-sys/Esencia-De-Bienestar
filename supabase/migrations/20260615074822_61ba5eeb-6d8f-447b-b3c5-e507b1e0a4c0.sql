
CREATE TABLE IF NOT EXISTS public.shopping_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_categories TO authenticated;
GRANT ALL ON public.shopping_categories TO service_role;

ALTER TABLE public.shopping_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read shopping categories"
  ON public.shopping_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage shopping categories"
  ON public.shopping_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_shopping_categories_updated
  BEFORE UPDATE ON public.shopping_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed with legacy defaults
INSERT INTO public.shopping_categories (name, sort_order) VALUES
  ('Proteínas', 10),
  ('Frutas y verduras', 20),
  ('Lácteos', 30),
  ('Cereales y legumbres', 40),
  ('Grasas saludables', 50),
  ('Otros', 60)
ON CONFLICT (name) DO NOTHING;

-- Seed with any existing distinct categories used in templates or items
INSERT INTO public.shopping_categories (name, sort_order)
SELECT DISTINCT trim(category), 100
FROM public.shopping_templates
WHERE category IS NOT NULL AND trim(category) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.shopping_categories (name, sort_order)
SELECT DISTINCT trim(category), 100
FROM public.shopping_list_items
WHERE category IS NOT NULL AND trim(category) <> ''
ON CONFLICT (name) DO NOTHING;
