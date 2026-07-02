CREATE TABLE IF NOT EXISTS public.spanish_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  nombre_normalizado text NOT NULL UNIQUE,
  aliases text[] NOT NULL DEFAULT '{}',
  categoria text NOT NULL DEFAULT 'general',
  estado text NOT NULL DEFAULT 'natural' CHECK (estado IN ('crudo', 'cocido', 'natural', 'procesado')),
  kcal_100g numeric,
  proteina_100g numeric,
  hidratos_100g numeric,
  grasa_100g numeric,
  fibra_100g numeric,
  azucares_100g numeric,
  sal_100g numeric,
  fuente text NOT NULL,
  verificado boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spanish_foods_nombre_idx
  ON public.spanish_foods USING gin (to_tsvector('simple', nombre));

CREATE INDEX IF NOT EXISTS spanish_foods_aliases_idx
  ON public.spanish_foods USING gin (aliases);

CREATE INDEX IF NOT EXISTS spanish_foods_categoria_idx
  ON public.spanish_foods (categoria);

CREATE INDEX IF NOT EXISTS spanish_foods_verified_idx
  ON public.spanish_foods (verificado, is_active);

ALTER TABLE public.spanish_foods ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.spanish_foods TO authenticated;
GRANT ALL ON public.spanish_foods TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'spanish_foods'
      AND policyname = 'spanish_foods_authenticated_read'
  ) THEN
    CREATE POLICY "spanish_foods_authenticated_read"
      ON public.spanish_foods
      FOR SELECT
      TO authenticated
      USING (is_active = true AND verificado = true);
  END IF;
END;
$$;

WITH seed (
  nombre,
  nombre_normalizado,
  aliases,
  categoria,
  estado,
  kcal_100g,
  proteina_100g,
  hidratos_100g,
  grasa_100g,
  fibra_100g,
  azucares_100g,
  sal_100g,
  fuente,
  verificado,
  is_active
) AS (
  VALUES
    ('Tomate natural', 'tomate', ARRAY['tomate fresco','tomate rojo','tomate maduro']::text[], 'verduras', 'natural', 18, 0.9, 3.9, 0.2, 1.2, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true),
    ('Calabacín', 'calabacin', ARRAY['calabacín','zucchini']::text[], 'verduras', 'natural', 17, 1.2, 3.1, 0.3, 1, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true),
    ('Zanahoria', 'zanahoria', ARRAY['zanahoria cruda']::text[], 'verduras', 'natural', 41, 0.9, 9.6, 0.2, 2.8, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true),
    ('Cebolla', 'cebolla', ARRAY['cebolla cruda']::text[], 'verduras', 'natural', 40, 1.1, 9.3, 0.1, 1.7, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true),
    ('Patata cocida', 'patata cocida', ARRAY['patata','papa','papa cocida','patata hervida','papa hervida']::text[], 'hidratos', 'cocido', 87, 1.9, 20.1, 0.1, 1.8, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true),
    ('Arroz blanco cocido', 'arroz blanco cocido', ARRAY['arroz','arroz blanco']::text[], 'hidratos', 'cocido', 130, 2.7, 28, 0.3, 0.4, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true),
    ('Arroz blanco crudo', 'arroz blanco crudo', ARRAY['arroz crudo']::text[], 'hidratos', 'crudo', 365, 7.1, 80, 0.7, 1.3, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true),
    ('Pechuga de pollo', 'pechuga de pollo', ARRAY['pollo','pollo natural','pollo crudo']::text[], 'proteína', 'natural', 110, 23, 0, 1.2, 0, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true),
    ('Manzana', 'manzana', ARRAY['manzana natural','manzana fresca']::text[], 'frutas', 'natural', 52, 0.3, 13.8, 0.2, 2.4, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true),
    ('Plátano', 'platano', ARRAY['plátano','banana']::text[], 'frutas', 'natural', 89, 1.1, 22.8, 0.3, 2.6, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true),
    ('Copos de avena', 'copos de avena', ARRAY['avena','avena en copos']::text[], 'hidratos', 'natural', 389, 16.9, 66.3, 6.9, 10.6, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true),
    ('Aceite de oliva', 'aceite de oliva', ARRAY['aove','aceite oliva','aceite de oliva virgen extra']::text[], 'grasas', 'natural', 884, 0, 0, 100, 0, NULL, NULL, 'BEDCA - Base de Datos Española de Composición de Alimentos (https://www.bedca.net/bdpub/)', true, true)
)
INSERT INTO public.spanish_foods (
  nombre,
  nombre_normalizado,
  aliases,
  categoria,
  estado,
  kcal_100g,
  proteina_100g,
  hidratos_100g,
  grasa_100g,
  fibra_100g,
  azucares_100g,
  sal_100g,
  fuente,
  verificado,
  is_active
)
SELECT
  nombre,
  nombre_normalizado,
  aliases,
  categoria,
  estado,
  kcal_100g,
  proteina_100g,
  hidratos_100g,
  grasa_100g,
  fibra_100g,
  azucares_100g,
  sal_100g,
  fuente,
  verificado,
  is_active
FROM seed
ON CONFLICT (nombre_normalizado) DO UPDATE
SET
  aliases = EXCLUDED.aliases,
  categoria = EXCLUDED.categoria,
  estado = EXCLUDED.estado,
  kcal_100g = EXCLUDED.kcal_100g,
  proteina_100g = EXCLUDED.proteina_100g,
  hidratos_100g = EXCLUDED.hidratos_100g,
  grasa_100g = EXCLUDED.grasa_100g,
  fibra_100g = EXCLUDED.fibra_100g,
  fuente = EXCLUDED.fuente,
  verificado = EXCLUDED.verificado,
  is_active = EXCLUDED.is_active,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
