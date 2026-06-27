CREATE TABLE IF NOT EXISTS public.internal_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  synonyms text[] NOT NULL DEFAULT '{}',
  base_quantity numeric NOT NULL DEFAULT 100,
  base_unit text NOT NULL DEFAULT 'g' CHECK (base_unit IN ('g', 'ml', 'serving')),
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'general',
  source text NOT NULL DEFAULT 'Tabla interna',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_foods_name_idx
  ON public.internal_foods USING gin (to_tsvector('simple', name));

CREATE INDEX IF NOT EXISTS internal_foods_synonyms_idx
  ON public.internal_foods USING gin (synonyms);

CREATE INDEX IF NOT EXISTS internal_foods_category_idx
  ON public.internal_foods (category);

CREATE INDEX IF NOT EXISTS internal_foods_active_idx
  ON public.internal_foods (is_active);

ALTER TABLE public.internal_foods ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.internal_foods TO authenticated;
GRANT ALL ON public.internal_foods TO service_role;

DROP POLICY IF EXISTS "internal_foods_authenticated_read" ON public.internal_foods;
CREATE POLICY "internal_foods_authenticated_read"
ON public.internal_foods
FOR SELECT
TO authenticated
USING (is_active = true);

WITH seed (name, synonyms, base_quantity, base_unit, calories, protein, carbs, fat, fiber, category, source, is_active) AS (
VALUES
  ('pollo', ARRAY['pechuga de pollo','pollo cocido'], 100, 'g', 165, 31, 0, 3.6, 0, 'proteína', 'Tabla interna', true),
  ('pechuga de pavo', ARRAY['pavo','fiambre de pavo','pavo en fiambre','pavo cocido','turkey breast','sliced turkey breast'], 100, 'g', 105, 22.5, 1, 1.5, 0, 'proteína', 'Tabla interna', true),
  ('huevo', ARRAY['huevos'], 100, 'g', 143, 12.6, 0.7, 9.5, 0, 'proteína', 'Tabla interna', true),
  ('clara de huevo', ARRAY['claras'], 100, 'g', 52, 10.9, 0.7, 0.2, 0, 'proteína', 'Tabla interna', true),
  ('atun', ARRAY['atún','atun natural','atún natural'], 100, 'g', 116, 25.5, 0, 0.8, 0, 'proteína', 'Tabla interna', true),
  ('salmon', ARRAY['salmón'], 100, 'g', 208, 20, 0, 13, 0, 'proteína', 'Tabla interna', true),
  ('lubina', ARRAY['robalo','sea bass','european sea bass'], 100, 'g', 97, 18.4, 0, 2, 0, 'proteína', 'Tabla interna', true),
  ('merluza', ARRAY[]::text[], 100, 'g', 89, 17, 0, 1.9, 0, 'proteína', 'Tabla interna', true),
  ('arroz', ARRAY['arroz cocido'], 100, 'g', 130, 2.7, 28, 0.3, 0.4, 'hidratos', 'Tabla interna', true),
  ('arroz integral', ARRAY[]::text[], 100, 'g', 123, 2.7, 25.6, 1, 1.8, 'hidratos', 'Tabla interna', true),
  ('tortitas de arroz', ARRAY['tortita de arroz','tortitas arroz','rice cakes','rice cake'], 100, 'g', 384, 7.3, 80, 2.8, 3.4, 'hidratos', 'Tabla interna', true),
  ('pasta', ARRAY['pasta cocida'], 100, 'g', 157, 5.8, 30.9, 0.9, 1.8, 'hidratos', 'Tabla interna', true),
  ('patata', ARRAY['papa'], 100, 'g', 87, 1.9, 20.1, 0.1, 1.8, 'hidratos', 'Tabla interna', true),
  ('boniato', ARRAY['batata'], 100, 'g', 86, 1.6, 20.1, 0.1, 3, 'hidratos', 'Tabla interna', true),
  ('avena', ARRAY[]::text[], 100, 'g', 389, 16.9, 66.3, 6.9, 10.6, 'hidratos', 'Tabla interna', true),
  ('quinoa', ARRAY[]::text[], 100, 'g', 120, 4.4, 21.3, 1.9, 2.8, 'hidratos', 'Tabla interna', true),
  ('garbanzos', ARRAY[]::text[], 100, 'g', 164, 8.9, 27.4, 2.6, 7.6, 'legumbres', 'Tabla interna', true),
  ('lentejas', ARRAY[]::text[], 100, 'g', 116, 9, 20, 0.4, 7.9, 'legumbres', 'Tabla interna', true),
  ('leche desnatada', ARRAY['leche desnatada con cafe','leche desnatada con café','leche descremada','leche sin grasa','skim milk','nonfat milk'], 100, 'ml', 34, 3.4, 5, 0.1, 0, 'lácteos', 'Tabla interna', true),
  ('queso fresco', ARRAY[]::text[], 100, 'g', 98, 12, 3, 4, 0, 'lácteos', 'Tabla interna', true),
  ('yogur natural', ARRAY[]::text[], 100, 'g', 61, 3.5, 4.7, 3.3, 0, 'lácteos', 'Tabla interna', true),
  ('yogur griego', ARRAY[]::text[], 100, 'g', 97, 9, 3.6, 5, 0, 'lácteos', 'Tabla interna', true),
  ('proteina en polvo', ARRAY['proteína','proteina','whey'], 100, 'g', 390, 78, 8, 6, 0, 'suplementos', 'Tabla interna', true),
  ('tomate', ARRAY[]::text[], 100, 'g', 18, 0.9, 3.9, 0.2, 1.2, 'verduras', 'Tabla interna', true),
  ('calabacin', ARRAY['calabacín'], 100, 'g', 17, 1.2, 3.1, 0.3, 1, 'verduras', 'Tabla interna', true),
  ('brocoli', ARRAY['brócoli'], 100, 'g', 34, 2.8, 6.6, 0.4, 2.6, 'verduras', 'Tabla interna', true),
  ('espinacas', ARRAY[]::text[], 100, 'g', 23, 2.9, 3.6, 0.4, 2.2, 'verduras', 'Tabla interna', true),
  ('zanahoria', ARRAY[]::text[], 100, 'g', 41, 0.9, 9.6, 0.2, 2.8, 'verduras', 'Tabla interna', true),
  ('cebolla', ARRAY[]::text[], 100, 'g', 40, 1.1, 9.3, 0.1, 1.7, 'verduras', 'Tabla interna', true),
  ('lechuga', ARRAY[]::text[], 100, 'g', 15, 1.4, 2.9, 0.2, 1.3, 'verduras', 'Tabla interna', true),
  ('fresas', ARRAY[]::text[], 100, 'g', 32, 0.7, 7.7, 0.3, 2, 'frutas', 'Tabla interna', true),
  ('platano', ARRAY['plátano','platanos','plátanos','banana','bananas'], 100, 'g', 89, 1.1, 22.8, 0.3, 2.6, 'frutas', 'Tabla interna', true),
  ('manzana', ARRAY[]::text[], 100, 'g', 52, 0.3, 13.8, 0.2, 2.4, 'frutas', 'Tabla interna', true),
  ('aguacate', ARRAY[]::text[], 100, 'g', 160, 2, 8.5, 14.7, 6.7, 'frutas', 'Tabla interna', true),
  ('aceite de oliva', ARRAY['aove','aceite'], 100, 'g', 884, 0, 0, 100, 0, 'grasas', 'Tabla interna', true),
  ('almendras', ARRAY[]::text[], 100, 'g', 579, 21.2, 21.6, 49.9, 12.5, 'frutos secos', 'Tabla interna', true),
  ('repollo', ARRAY['col'], 100, 'g', 25, 1.3, 5.8, 0.1, 2.5, 'verduras', 'Tabla interna', true),
  ('queso cottage', ARRAY['cottage','queso cottage bajo en grasa'], 100, 'g', 98, 11.1, 3.4, 4.3, 0, 'lácteos', 'Tabla interna', true),
  ('cerveza rubia', ARRAY['cerveza','lager'], 100, 'ml', 43, 0.5, 3.6, 0, 0, 'bebidas', 'Tabla interna', true),
  ('cerveza sin alcohol', ARRAY['cerveza 0,0','cerveza 0.0','cerveza sin alcohol rubia'], 100, 'ml', 22, 0.3, 4.7, 0, 0, 'bebidas', 'Tabla interna', true),
  ('ajo', ARRAY['diente de ajo','ajos'], 100, 'g', 149, 6.4, 33.1, 0.5, 2.1, 'verduras', 'Tabla interna', true),
  ('vino blanco', ARRAY[]::text[], 100, 'ml', 82, 0.1, 2.6, 0, 0, 'bebidas', 'Tabla interna', true),
  ('vino tinto', ARRAY[]::text[], 100, 'ml', 85, 0.1, 2.6, 0, 0, 'bebidas', 'Tabla interna', true),
  ('pan integral', ARRAY['pan de trigo integral'], 100, 'g', 247, 9, 41, 4.2, 7, 'hidratos', 'Tabla interna', true),
  ('bebida vegetal sin azucares', ARRAY['bebida vegetal sin azúcares','leche vegetal sin azucar','leche vegetal sin azúcar'], 100, 'ml', 33, 1.2, 1.4, 2.3, 0.4, 'bebidas vegetales', 'Tabla interna', true),
  ('ajo en polvo', ARRAY['ajo molido'], 100, 'g', 331, 16.6, 72.7, 0.7, 9, 'especias', 'Tabla interna', true),
  ('perejil', ARRAY['perejil fresco'], 100, 'g', 36, 3, 6.3, 0.8, 3.3, 'especias', 'Tabla interna', true),
  ('tomates cherry', ARRAY['tomate cherry','tomates cherrys','cherrys'], 100, 'g', 18, 0.9, 3.9, 0.2, 1.2, 'verduras', 'Tabla interna', true),
  ('jamon serrano', ARRAY['jamón serrano','jamon curado','jamón curado','jamon serrano a taquitos','jamón serrano a taquitos','taquitos de jamon','taquitos de jamón'], 100, 'g', 241, 31, 0.5, 13, 0, 'proteína', 'Tabla interna', true),
  ('pimiento rojo', ARRAY['pimiento','pimientos'], 100, 'g', 31, 1, 6, 0.3, 2.1, 'verduras', 'Tabla interna', true),
  ('atun en aceite de oliva', ARRAY['atún en aceite de oliva','atun en aceite','atún en aceite'], 100, 'g', 198, 29, 0, 8.2, 0, 'pescados', 'Tabla interna', true),
  ('guisantes', ARRAY['peas'], 100, 'g', 81, 5.4, 14.5, 0.4, 5.1, 'legumbres', 'Tabla interna', true),
  ('judias verdes', ARRAY['judías verdes','judia verde','judía verde','vainas'], 100, 'g', 31, 1.8, 7, 0.1, 3.4, 'verduras', 'Tabla interna', true),
  ('pimienta negra', ARRAY['pimienta'], 100, 'g', 251, 10.4, 64, 3.3, 25.3, 'especias', 'Tabla interna', true),
  ('oregano', ARRAY['orégano'], 100, 'g', 265, 9, 68.9, 4.3, 42.5, 'especias', 'Tabla interna', true),
  ('comino', ARRAY['comino molido'], 100, 'g', 375, 17.8, 44.2, 22.3, 10.5, 'especias', 'Tabla interna', true),
  ('curry', ARRAY['curry en polvo'], 100, 'g', 325, 14.3, 55.8, 14, 33.2, 'especias', 'Tabla interna', true),
  ('sal', ARRAY['sal fina','sal marina'], 100, 'g', 0, 0, 0, 0, 0, 'especias', 'Tabla interna', true),
  ('laurel', ARRAY['hoja de laurel','hojas de laurel'], 100, 'g', 313, 7.6, 74.9, 8.4, 26.3, 'especias', 'Tabla interna', true),
  ('especias mixtas', ARRAY['mezcla de especias','hierbas provenzales','condimento mixto'], 100, 'g', 250, 10, 50, 5, 25, 'especias', 'Tabla interna', true),
  ('kefir', ARRAY['kéfir'], 100, 'g', 64, 3.3, 4.7, 3.5, 0, 'lácteos', 'Tabla interna', true),
  ('yogur de proteina', ARRAY['yogur de proteína','yogures de proteina','yogures de proteína','yogur proteico','yogur alto en proteina','yogur alto en proteína'], 100, 'g', 60, 10, 4, 0.5, 0, 'lácteos', 'Tabla interna', true)
)
INSERT INTO public.internal_foods
  (name, synonyms, base_quantity, base_unit, calories, protein, carbs, fat, fiber, category, source, is_active)
SELECT name, synonyms, base_quantity, base_unit, calories, protein, carbs, fat, fiber, category, source, is_active
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.internal_foods existing
  WHERE lower(existing.name) = lower(seed.name)
);

NOTIFY pgrst, 'reload schema';
