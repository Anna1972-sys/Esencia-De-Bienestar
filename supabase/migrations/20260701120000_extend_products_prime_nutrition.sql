BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS serving_size text,
  ADD COLUMN IF NOT EXISTS serving_grams numeric,
  ADD COLUMN IF NOT EXISTS serving_calories numeric,
  ADD COLUMN IF NOT EXISTS serving_protein numeric,
  ADD COLUMN IF NOT EXISTS serving_carbs numeric,
  ADD COLUMN IF NOT EXISTS serving_sugars numeric,
  ADD COLUMN IF NOT EXISTS serving_fat numeric,
  ADD COLUMN IF NOT EXISTS serving_saturated_fat numeric,
  ADD COLUMN IF NOT EXISTS serving_fiber numeric,
  ADD COLUMN IF NOT EXISTS serving_salt numeric,
  ADD COLUMN IF NOT EXISTS saturated_fat numeric,
  ADD COLUMN IF NOT EXISTS kcal_per_gram numeric,
  ADD COLUMN IF NOT EXISTS protein_per_gram numeric,
  ADD COLUMN IF NOT EXISTS carbs_per_gram numeric,
  ADD COLUMN IF NOT EXISTS fat_per_gram numeric,
  ADD COLUMN IF NOT EXISTS fiber_per_gram numeric,
  ADD COLUMN IF NOT EXISTS nutrition_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS label_file_url text;

ALTER TABLE public.product_measures
  ADD COLUMN IF NOT EXISTS sugars numeric,
  ADD COLUMN IF NOT EXISTS saturated_fat numeric,
  ADD COLUMN IF NOT EXISTS salt numeric;

CREATE INDEX IF NOT EXISTS idx_products_prime_line
  ON public.products(line);

CREATE INDEX IF NOT EXISTS idx_products_nutrition_verified_at
  ON public.products(nutrition_verified_at);

CREATE OR REPLACE FUNCTION public.calculate_product_prime_nutrition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.serving_grams IS NOT NULL AND NEW.serving_grams > 0 THEN
    NEW.calories := COALESCE(NEW.calories, NEW.serving_calories / NEW.serving_grams * 100);
    NEW.protein := COALESCE(NEW.protein, NEW.serving_protein / NEW.serving_grams * 100);
    NEW.carbs := COALESCE(NEW.carbs, NEW.serving_carbs / NEW.serving_grams * 100);
    NEW.sugars := COALESCE(NEW.sugars, NEW.serving_sugars / NEW.serving_grams * 100);
    NEW.fat := COALESCE(NEW.fat, NEW.serving_fat / NEW.serving_grams * 100);
    NEW.saturated_fat := COALESCE(NEW.saturated_fat, NEW.serving_saturated_fat / NEW.serving_grams * 100);
    NEW.fiber := COALESCE(NEW.fiber, NEW.serving_fiber / NEW.serving_grams * 100);
    NEW.salt := COALESCE(NEW.salt, NEW.serving_salt / NEW.serving_grams * 100);
  END IF;

  NEW.kcal_per_gram := CASE
    WHEN NEW.calories IS NOT NULL THEN NEW.calories / 100
    WHEN NEW.serving_grams IS NOT NULL AND NEW.serving_grams > 0 THEN NEW.serving_calories / NEW.serving_grams
    ELSE NULL
  END;

  NEW.protein_per_gram := CASE
    WHEN NEW.protein IS NOT NULL THEN NEW.protein / 100
    WHEN NEW.serving_grams IS NOT NULL AND NEW.serving_grams > 0 THEN NEW.serving_protein / NEW.serving_grams
    ELSE NULL
  END;

  NEW.carbs_per_gram := CASE
    WHEN NEW.carbs IS NOT NULL THEN NEW.carbs / 100
    WHEN NEW.serving_grams IS NOT NULL AND NEW.serving_grams > 0 THEN NEW.serving_carbs / NEW.serving_grams
    ELSE NULL
  END;

  NEW.fat_per_gram := CASE
    WHEN NEW.fat IS NOT NULL THEN NEW.fat / 100
    WHEN NEW.serving_grams IS NOT NULL AND NEW.serving_grams > 0 THEN NEW.serving_fat / NEW.serving_grams
    ELSE NULL
  END;

  NEW.fiber_per_gram := CASE
    WHEN NEW.fiber IS NOT NULL THEN NEW.fiber / 100
    WHEN NEW.serving_grams IS NOT NULL AND NEW.serving_grams > 0 THEN NEW.serving_fiber / NEW.serving_grams
    ELSE NULL
  END;

  IF NEW.verification_status = 'verificado' AND NEW.nutrition_verified_at IS NULL THEN
    NEW.nutrition_verified_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_calculate_product_prime_nutrition'
  ) THEN
    CREATE TRIGGER trg_calculate_product_prime_nutrition
      BEFORE INSERT OR UPDATE ON public.products
      FOR EACH ROW
      EXECUTE FUNCTION public.calculate_product_prime_nutrition();
  END IF;
END;
$$;

COMMIT;
