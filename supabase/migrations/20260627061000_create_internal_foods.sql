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

CREATE INDEX IF NOT EXISTS internal_foods_name_idx ON public.internal_foods USING gin (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS internal_foods_synonyms_idx ON public.internal_foods USING gin (synonyms);
CREATE INDEX IF NOT EXISTS internal_foods_active_idx ON public.internal_foods (is_active);

ALTER TABLE public.internal_foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read active internal foods" ON public.internal_foods;
CREATE POLICY "Authenticated can read active internal foods"
ON public.internal_foods FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage internal foods" ON public.internal_foods;
CREATE POLICY "Admins can manage internal foods"
ON public.internal_foods FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_internal_foods_updated_at ON public.internal_foods;
CREATE TRIGGER update_internal_foods_updated_at
BEFORE UPDATE ON public.internal_foods
FOR EACH ROW EXECUTE FUNCTION public.update_wellness_entries_updated_at();

INSERT INTO public.internal_foods
  (name, synonyms, base_quantity, base_unit, calories, protein, carbs, fat, fiber, category, source, is_active)
VALUES
  ('pollo', ARRAY['pechuga de pollo','pollo cocido'], 100, 'g', 165, 31, 0, 3.6, 0, 'proteína', 'Tabla interna', true),
  ('pechuga de pavo', ARRAY['pavo','fiambre de pavo','pavo cocido','turkey breast','sliced turkey breast'], 100, 'g', 105, 22.5, 1, 1.5, 0, 'proteína', 'Tabla interna', true),
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
  ('platano', ARRAY['plátano','banana'], 100, 'g', 89, 1.1, 22.8, 0.3, 2.6, 'frutas', 'Tabla interna', true),
  ('manzana', ARRAY[]::text[], 100, 'g', 52, 0.3, 13.8, 0.2, 2.4, 'frutas', 'Tabla interna', true),
  ('aguacate', ARRAY[]::text[], 100, 'g', 160, 2, 8.5, 14.7, 6.7, 'frutas', 'Tabla interna', true),
  ('aceite de oliva', ARRAY['aove','aceite'], 100, 'g', 884, 0, 0, 100, 0, 'grasas', 'Tabla interna', true),
  ('almendras', ARRAY[]::text[], 100, 'g', 579, 21.2, 21.6, 49.9, 12.5, 'frutos secos', 'Tabla interna', true)
ON CONFLICT DO NOTHING;
