
-- Normalize category names with propagation to items and templates
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Proteinas -> Proteínas
  IF EXISTS (SELECT 1 FROM public.shopping_categories WHERE name = 'Proteinas')
     AND NOT EXISTS (SELECT 1 FROM public.shopping_categories WHERE name = 'Proteínas') THEN
    UPDATE public.shopping_list_items SET category = 'Proteínas' WHERE category = 'Proteinas';
    UPDATE public.shopping_templates   SET category = 'Proteínas' WHERE category = 'Proteinas';
    UPDATE public.shopping_categories  SET name = 'Proteínas' WHERE name = 'Proteinas';
  END IF;

  -- Semillas  y Frutos secos -> Semillas y frutos secos
  IF EXISTS (SELECT 1 FROM public.shopping_categories WHERE name = 'Semillas  y Frutos secos')
     AND NOT EXISTS (SELECT 1 FROM public.shopping_categories WHERE name = 'Semillas y frutos secos') THEN
    UPDATE public.shopping_list_items SET category = 'Semillas y frutos secos' WHERE category = 'Semillas  y Frutos secos';
    UPDATE public.shopping_templates   SET category = 'Semillas y frutos secos' WHERE category = 'Semillas  y Frutos secos';
    UPDATE public.shopping_categories  SET name = 'Semillas y frutos secos' WHERE name = 'Semillas  y Frutos secos';
  END IF;
END $$;

-- Ensure missing categories exist
INSERT INTO public.shopping_categories (name, sort_order)
SELECT v.name, v.sort_order FROM (VALUES
  ('Condimentos y especias', 70),
  ('Bebidas', 80)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.shopping_categories sc WHERE sc.name = v.name);

-- Admin can read and update shopping_list_items of any user (no delete, no insert)
DROP POLICY IF EXISTS "shopping_items_admin_read" ON public.shopping_list_items;
CREATE POLICY "shopping_items_admin_read"
  ON public.shopping_list_items FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "shopping_items_admin_update" ON public.shopping_list_items;
CREATE POLICY "shopping_items_admin_update"
  ON public.shopping_list_items FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
