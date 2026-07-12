ALTER TABLE public.internal_foods
  ADD COLUMN IF NOT EXISTS azucares_g numeric,
  ADD COLUMN IF NOT EXISTS grasas_saturadas_g numeric;
