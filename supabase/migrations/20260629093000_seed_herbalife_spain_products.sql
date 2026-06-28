ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS line text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Pendiente de etiqueta oficial',
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS nutrition_effective_from timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.product_measures
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Pendiente de etiqueta oficial',
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pendiente';

CREATE INDEX IF NOT EXISTS idx_products_aliases ON public.products USING gin (aliases);
CREATE INDEX IF NOT EXISTS idx_products_verification_status ON public.products(verification_status);
CREATE INDEX IF NOT EXISTS idx_product_measures_verification_status ON public.product_measures(verification_status);

CREATE TABLE IF NOT EXISTS public.product_nutrition_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric NOT NULL DEFAULT 0,
  sugars numeric NOT NULL DEFAULT 0,
  salt numeric NOT NULL DEFAULT 0,
  micronutrients jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'Pendiente de etiqueta oficial',
  verification_status text NOT NULL DEFAULT 'pendiente',
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_nutrition_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_nutrition_versions'
      AND policyname = 'product_nutrition_versions_admin_manage'
  ) THEN
    CREATE POLICY "product_nutrition_versions_admin_manage"
      ON public.product_nutrition_versions FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_nutrition_versions'
      AND policyname = 'product_nutrition_versions_authenticated_read'
  ) THEN
    CREATE POLICY "product_nutrition_versions_authenticated_read"
      ON public.product_nutrition_versions FOR SELECT TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1
          FROM public.products p
          WHERE p.id = product_nutrition_versions.product_id
            AND p.is_active = true
            AND (p.visible_to_clients = true OR p.available_for_recipes = true)
        )
      );
  END IF;
END $$;

GRANT SELECT ON public.product_nutrition_versions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_nutrition_versions TO authenticated;

INSERT INTO public.product_categories (name, slug, description, sort_order, is_active)
VALUES
  ('Control de peso', 'control-de-peso', 'Productos Herbalife España para control de peso y batidos.', 10, true),
  ('Nutrición deportiva', 'nutricion-deportiva-productos', 'Productos Herbalife24 y apoyo deportivo.', 20, true),
  ('Nutrición y salud', 'nutricion-y-salud-productos', 'Productos de apoyo nutricional general.', 30, true),
  ('Hidratación y energía', 'hidratacion-y-energia', 'Bebidas, hidratación y energía.', 40, true),
  ('Bienestar digestivo', 'bienestar-digestivo', 'Productos de aloe y apoyo digestivo.', 50, true)
ON CONFLICT (slug) DO NOTHING;

WITH seed_products AS (
  SELECT *
  FROM (VALUES
    ('Fórmula 1', 'formula-1', 'Control de peso', 'control-de-peso', ARRAY['F1','Formula 1','Fórmula Uno','Formula Uno','Batido Herbalife','Batido Fórmula 1','Batido Formula 1','F1 vainilla'], true, true, 'Pendiente de etiqueta oficial Herbalife España. Medidas de cuchara basadas en imagen aportada por administración el 2026-06-28.', 'pendiente', 10),
    ('PDM', 'pdm', 'Control de peso', 'control-de-peso', ARRAY['Protein Drink Mix','Proteína Drink Mix','Bebida de proteína','PDM Herbalife'], true, true, 'Pendiente de etiqueta oficial Herbalife España. Medidas de cuchara basadas en imagen aportada por administración el 2026-06-28.', 'pendiente', 20),
    ('PPP', 'ppp', 'Nutrición deportiva', 'nutricion-deportiva-productos', ARRAY['Proteína Personalizada','Proteina Personalizada','Personalized Protein Powder','PPP Herbalife'], true, true, 'Pendiente de etiqueta oficial Herbalife España. Medida de cuchara basada en imagen aportada por administración el 2026-06-28.', 'pendiente', 30),
    ('Beta Heart', 'beta-heart', 'Nutrición y salud', 'nutricion-y-salud-productos', ARRAY['Betta Heart','BetaHeart','Beta-Heart'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 40),
    ('Colágeno', 'colageno', 'Nutrición y salud', 'nutricion-y-salud-productos', ARRAY['Collagen','Colageno','Colágeno Herbalife','Collagen Skin Booster'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 50),
    ('Concentrado de hierbas', 'concentrado-de-hierbas', 'Hidratación y energía', 'hidratacion-y-energia', ARRAY['HTC','Té Herbalife','Te Herbalife','Concentrado de Hierbas Té','Concentrado de Hierbas Te','Herbal Tea Concentrate'], true, true, 'Pendiente de etiqueta oficial Herbalife España. Medida de cuchara basada en imagen aportada por administración el 2026-06-28.', 'pendiente', 60),
    ('Aloe Max', 'aloe-max', 'Bienestar digestivo', 'bienestar-digestivo', ARRAY['AloeMax','Aloe Herbalife Max'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 70),
    ('Aloe Mango', 'aloe-mango', 'Bienestar digestivo', 'bienestar-digestivo', ARRAY['Aloe sabor mango','Aloe Herbalife Mango','Herbal Aloe Mango'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 80),
    ('CR7', 'cr7', 'Hidratación y energía', 'hidratacion-y-energia', ARRAY['CR7 Drive','Cristiano Ronaldo Drink','Bebida CR7'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 90),
    ('Prolong', 'prolong', 'Nutrición deportiva', 'nutricion-deportiva-productos', ARRAY['H24 Prolong','Herbalife24 Prolong'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 100),
    ('Rebuild Strength', 'rebuild-strength', 'Nutrición deportiva', 'nutricion-deportiva-productos', ARRAY['H24 Rebuild Strength','Herbalife24 Rebuild Strength','Rebuild'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 110),
    ('Liftoff', 'liftoff', 'Hidratación y energía', 'hidratacion-y-energia', ARRAY['Lift Off','Herbalife Liftoff','Energía Herbalife','Energia Herbalife'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 120),
    ('Barritas H24', 'barritas-h24', 'Nutrición deportiva', 'nutricion-deportiva-productos', ARRAY['H24 Bar','Barrita H24','Barritas Herbalife24'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 130),
    ('Barritas Fórmula 1', 'barritas-formula-1', 'Control de peso', 'control-de-peso', ARRAY['Barrita Fórmula 1','Barritas Formula 1','Barrita Formula 1','F1 Express Bar'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 140),
    ('Barritas Snacks', 'barritas-snacks', 'Control de peso', 'control-de-peso', ARRAY['Snack Bar','Barrita Snack','Barritas snack Herbalife'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 150),
    ('Hydrate', 'hydrate', 'Hidratación y energía', 'hidratacion-y-energia', ARRAY['H24 Hydrate','Herbalife24 Hydrate','Bebida Hydrate'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 160),
    ('Avena Manzana y Fibra', 'avena-manzana-y-fibra', 'Control de peso', 'control-de-peso', ARRAY['Avena Manzana Fibra','Avena y Fibra','Apple Fibre Oat Drink','Bebida de avena manzana y fibra'], true, true, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', 170)
  ) AS p(name, slug, line, category_slug, aliases, visible_to_clients, available_for_recipes, source, verification_status, sort_order)
)
INSERT INTO public.products (
  name,
  slug,
  line,
  category_id,
  aliases,
  visible_to_clients,
  available_for_recipes,
  informative_only,
  calories,
  protein,
  carbs,
  fat,
  fiber,
  sugars,
  salt,
  micronutrients,
  source,
  verification_status,
  is_active,
  sort_order
)
SELECT
  p.name,
  p.slug,
  p.line,
  c.id,
  p.aliases,
  p.visible_to_clients,
  p.available_for_recipes,
  false,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  '{}'::jsonb,
  p.source,
  p.verification_status,
  true,
  p.sort_order
FROM seed_products p
JOIN public.product_categories c ON c.slug = p.category_slug
ON CONFLICT (slug) DO NOTHING;

WITH measure_seed AS (
  SELECT *
  FROM (VALUES
    ('formula-1', '1 cuchara rasa', 14::numeric, 'Imagen cuchara dosificadora Herbalife aportada por administración el 2026-06-28: parte superior grande F1/PDM, 1 cuchara rasa = 14 g.', 'pendiente', true, 10),
    ('formula-1', '2 cucharas rasas', 28::numeric, 'Imagen cuchara dosificadora Herbalife aportada por administración el 2026-06-28: parte superior grande F1/PDM, 2 cucharas rasas = 28 g.', 'pendiente', false, 20),
    ('formula-1', '100 g', 100::numeric, 'Medida base por 100 g para ficha nutricional.', 'pendiente', false, 30),
    ('pdm', '1 cuchara rasa', 14::numeric, 'Imagen cuchara dosificadora Herbalife aportada por administración el 2026-06-28: parte superior grande F1/PDM, 1 cuchara rasa = 14 g.', 'pendiente', true, 10),
    ('pdm', '2 cucharas rasas', 28::numeric, 'Imagen cuchara dosificadora Herbalife aportada por administración el 2026-06-28: parte superior grande F1/PDM, 2 cucharas rasas = 28 g.', 'pendiente', false, 20),
    ('pdm', '100 g', 100::numeric, 'Medida base por 100 g para ficha nutricional.', 'pendiente', false, 30),
    ('ppp', '1 cuchara rasa', 6::numeric, 'Imagen cuchara dosificadora Herbalife aportada por administración el 2026-06-28: parte superior pequeña PPP, 1 cuchara rasa = 6 g.', 'pendiente', true, 10),
    ('ppp', '1/2 cuchara rasa', 3::numeric, 'Calculado desde imagen aportada por administración el 2026-06-28: 1/2 de cuchara PPP de 6 g.', 'pendiente', false, 20),
    ('ppp', '100 g', 100::numeric, 'Medida base por 100 g para ficha nutricional.', 'pendiente', false, 30),
    ('concentrado-de-hierbas', '1 cuchara rasa', 1.7::numeric, 'Imagen cuchara dosificadora Herbalife aportada por administración el 2026-06-28: parte inferior grande HTC, 1 cuchara rasa = 1,7 g.', 'pendiente', true, 10),
    ('concentrado-de-hierbas', '100 g', 100::numeric, 'Medida base por 100 g para ficha nutricional.', 'pendiente', false, 20),
    ('beta-heart', '100 g', 100::numeric, 'Medida base por 100 g para ficha nutricional pendiente de etiqueta oficial.', 'pendiente', true, 10),
    ('colageno', '100 g', 100::numeric, 'Medida base por 100 g para ficha nutricional pendiente de etiqueta oficial.', 'pendiente', true, 10),
    ('aloe-max', '100 ml', 100::numeric, 'Medida base por 100 ml para ficha nutricional pendiente de etiqueta oficial.', 'pendiente', true, 10),
    ('aloe-mango', '100 ml', 100::numeric, 'Medida base por 100 ml para ficha nutricional pendiente de etiqueta oficial.', 'pendiente', true, 10),
    ('cr7', '100 ml preparado', 100::numeric, 'Medida base pendiente de etiqueta oficial.', 'pendiente', true, 10),
    ('prolong', '100 g', 100::numeric, 'Medida base por 100 g para ficha nutricional pendiente de etiqueta oficial.', 'pendiente', true, 10),
    ('rebuild-strength', '100 g', 100::numeric, 'Medida base por 100 g para ficha nutricional pendiente de etiqueta oficial.', 'pendiente', true, 10),
    ('liftoff', '1 tableta', 0::numeric, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', true, 10),
    ('barritas-h24', '1 barrita', 0::numeric, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', true, 10),
    ('barritas-formula-1', '1 barrita', 0::numeric, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', true, 10),
    ('barritas-snacks', '1 barrita', 0::numeric, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', true, 10),
    ('hydrate', '1 sobre', 0::numeric, 'Pendiente de etiqueta oficial Herbalife España.', 'pendiente', true, 10),
    ('avena-manzana-y-fibra', '100 g', 100::numeric, 'Medida base por 100 g para ficha nutricional pendiente de etiqueta oficial.', 'pendiente', true, 10)
  ) AS m(product_slug, name, grams, source, verification_status, is_default, sort_order)
)
INSERT INTO public.product_measures (
  product_id,
  name,
  grams,
  calories,
  protein,
  carbs,
  fat,
  fiber,
  source,
  verification_status,
  is_default,
  sort_order
)
SELECT
  p.id,
  m.name,
  m.grams,
  0,
  0,
  0,
  0,
  0,
  m.source,
  m.verification_status,
  m.is_default,
  m.sort_order
FROM measure_seed m
JOIN public.products p ON p.slug = m.product_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_measures existing
  WHERE existing.product_id = p.id
    AND lower(existing.name) = lower(m.name)
);
