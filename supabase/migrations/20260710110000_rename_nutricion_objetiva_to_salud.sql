UPDATE public.product_categories
SET
  name = 'Nutrición y Salud',
  updated_at = now()
WHERE
  slug = 'nutricion-objetiva'
  OR name IN ('Nutrición Objetiva', 'Nutrición objetiva');
