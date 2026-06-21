CREATE TABLE public.nutrition_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  emoji text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nutrition_categories TO authenticated;
GRANT ALL ON public.nutrition_categories TO service_role;

ALTER TABLE public.nutrition_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read nutrition categories"
ON public.nutrition_categories
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage nutrition categories"
ON public.nutrition_categories
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.nutrition_categories (key, label, emoji, sort_order) VALUES
  ('hidratacion', 'Hidratación', '💧', 1),
  ('proteinas', 'Proteínas', '🥚', 2),
  ('pre-entreno', 'Pre-entreno', '⚡', 3),
  ('post-entreno', 'Post-entreno', '🌿', 4),
  ('suplementacion', 'Suplementación', '💊', 5),
  ('recetas', 'Recetas deportivas', '🍓', 6),
  ('planes', 'Planes y guías', '📅', 7);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_nutrition_categories_updated_at
BEFORE UPDATE ON public.nutrition_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();