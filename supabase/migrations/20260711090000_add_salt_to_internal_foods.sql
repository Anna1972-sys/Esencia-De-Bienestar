ALTER TABLE public.internal_foods
  ADD COLUMN IF NOT EXISTS salt numeric NOT NULL DEFAULT 0;

UPDATE public.internal_foods
SET salt = 0
WHERE salt IS NULL;

UPDATE public.food_items i
SET
  sal_100g = COALESCE(i.sal_100g, f.salt * 100 / NULLIF(f.base_quantity, 0), 0),
  raw_data = COALESCE(i.raw_data, '{}'::jsonb) || jsonb_build_object('internal_foods_salt_synced_at', now())
FROM public.internal_foods f
WHERE i.source_type = 'manual'
  AND i.raw_data->>'legacy_table' = 'internal_foods'
  AND i.raw_data->>'legacy_id' = f.id::text;

NOTIFY pgrst, 'reload schema';
