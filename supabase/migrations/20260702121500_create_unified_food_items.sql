CREATE TABLE IF NOT EXISTS public.food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('bedca', 'usda', 'open_food_facts', 'manual')),
  source_id text NOT NULL DEFAULT '',
  nombre text NOT NULL,
  nombre_normalizado text NOT NULL,
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
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT food_items_source_normalized_unique UNIQUE (source_type, nombre_normalizado, source_id)
);

CREATE INDEX IF NOT EXISTS food_items_nombre_idx
  ON public.food_items USING gin (to_tsvector('simple', nombre));

CREATE INDEX IF NOT EXISTS food_items_aliases_idx
  ON public.food_items USING gin (aliases);

CREATE INDEX IF NOT EXISTS food_items_source_priority_idx
  ON public.food_items (source_type, verificado, is_active);

CREATE INDEX IF NOT EXISTS food_items_categoria_idx
  ON public.food_items (categoria);

ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.food_items TO authenticated;
GRANT ALL ON public.food_items TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'food_items'
      AND policyname = 'food_items_authenticated_read'
  ) THEN
    CREATE POLICY "food_items_authenticated_read"
      ON public.food_items
      FOR SELECT
      TO authenticated
      USING (is_active = true AND verificado = true);
  END IF;
END;
$$;

WITH prepared_internal_foods AS (
  SELECT
    f.*,
    lower(
      trim(
        regexp_replace(
          translate(
            f.name,
            'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛáàäâéèëêíìïîóòöôúùüûÇç',
            'AAAAEEEEIIIIOOOOUUUUaaaaeeeeiiiioooouuuucc'
          ),
          '[^a-zA-Z0-9ñÑ]+',
          ' ',
          'g'
        )
      )
    ) AS normalized_name,
    row_number() OVER (
      PARTITION BY
        'manual',
        lower(
          trim(
            regexp_replace(
              translate(
                f.name,
                'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛáàäâéèëêíìïîóòöôúùüûÇç',
                'AAAAEEEEIIIIOOOOUUUUaaaaeeeeiiiioooouuuucc'
              ),
              '[^a-zA-Z0-9ñÑ]+',
              ' ',
              'g'
            )
          )
        ),
        ''
      ORDER BY
        coalesce(f.is_active, true) DESC,
        f.updated_at DESC NULLS LAST,
        f.created_at DESC NULLS LAST,
        f.id
    ) AS dedupe_rank
  FROM public.internal_foods f
  WHERE coalesce(f.is_active, true) = true
)
INSERT INTO public.food_items (
  source_type,
  source_id,
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
  is_active,
  raw_data
)
SELECT
  'manual',
  '',
  f.name,
  f.normalized_name,
  coalesce(f.synonyms, ARRAY[]::text[]),
  coalesce(f.category, 'general'),
  CASE
    WHEN lower(f.name) ~ '(crudo|cruda)' THEN 'crudo'
    WHEN lower(f.name) ~ '(cocido|cocida|hervido|hervida)' THEN 'cocido'
    WHEN lower(f.name) ~ '(frito|frita|galleta|pan|harina|concentrado|deshidratado|procesado)' THEN 'procesado'
    ELSE 'natural'
  END,
  f.calories * 100 / nullif(f.base_quantity, 0),
  f.protein * 100 / nullif(f.base_quantity, 0),
  f.carbs * 100 / nullif(f.base_quantity, 0),
  f.fat * 100 / nullif(f.base_quantity, 0),
  f.fiber * 100 / nullif(f.base_quantity, 0),
  NULL,
  NULL,
  coalesce(f.source, 'Tabla interna'),
  true,
  coalesce(f.is_active, true),
  jsonb_build_object(
    'legacy_table', 'internal_foods',
    'legacy_id', f.id,
    'base_quantity', f.base_quantity,
    'base_unit', f.base_unit,
    'original_source', f.source
  )
FROM prepared_internal_foods f
WHERE f.dedupe_rank = 1
ON CONFLICT (source_type, nombre_normalizado, source_id) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  aliases = EXCLUDED.aliases,
  categoria = EXCLUDED.categoria,
  estado = EXCLUDED.estado,
  kcal_100g = EXCLUDED.kcal_100g,
  proteina_100g = EXCLUDED.proteina_100g,
  hidratos_100g = EXCLUDED.hidratos_100g,
  grasa_100g = EXCLUDED.grasa_100g,
  fibra_100g = EXCLUDED.fibra_100g,
  azucares_100g = EXCLUDED.azucares_100g,
  sal_100g = EXCLUDED.sal_100g,
  fuente = EXCLUDED.fuente,
  verificado = EXCLUDED.verificado,
  is_active = EXCLUDED.is_active,
  raw_data = EXCLUDED.raw_data,
  imported_at = now(),
  updated_at = now();

NOTIFY pgrst, 'reload schema';
