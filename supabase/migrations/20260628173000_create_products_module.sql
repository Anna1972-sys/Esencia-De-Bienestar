CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image_url text,
  gallery_urls text[] NOT NULL DEFAULT '{}',
  video_urls text[] NOT NULL DEFAULT '{}',
  pdf_urls text[] NOT NULL DEFAULT '{}',
  external_urls text[] NOT NULL DEFAULT '{}',
  description text,
  benefits text,
  usage text,
  ingredients_text text,
  observations text,
  free_text text,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric NOT NULL DEFAULT 0,
  sugars numeric NOT NULL DEFAULT 0,
  salt numeric NOT NULL DEFAULT 0,
  micronutrients jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  visible_to_clients boolean NOT NULL DEFAULT true,
  available_for_recipes boolean NOT NULL DEFAULT true,
  informative_only boolean NOT NULL DEFAULT false,
  herbalife_spoon_measure_id uuid,
  spoon_image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_measures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  grams numeric NOT NULL DEFAULT 0,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_sort ON public.product_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_product_categories_active ON public.product_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_visibility ON public.products(is_active, visible_to_clients, available_for_recipes);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_product_measures_product ON public.product_measures(product_id);
CREATE INDEX IF NOT EXISTS idx_product_measures_default ON public.product_measures(product_id, is_default);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_measures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_categories_authenticated_read" ON public.product_categories;
CREATE POLICY "product_categories_authenticated_read"
  ON public.product_categories FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "product_categories_admin_manage" ON public.product_categories;
CREATE POLICY "product_categories_admin_manage"
  ON public.product_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "products_authenticated_read" ON public.products;
CREATE POLICY "products_authenticated_read"
  ON public.products FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      is_active = true
      AND (
        visible_to_clients = true
        OR available_for_recipes = true
      )
    )
  );

DROP POLICY IF EXISTS "products_admin_manage" ON public.products;
CREATE POLICY "products_admin_manage"
  ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "product_measures_authenticated_read" ON public.product_measures;
CREATE POLICY "product_measures_authenticated_read"
  ON public.product_measures FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_measures.product_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR (
            p.is_active = true
            AND (
              p.visible_to_clients = true
              OR p.available_for_recipes = true
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "product_measures_admin_manage" ON public.product_measures;
CREATE POLICY "product_measures_admin_manage"
  ON public.product_measures FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.product_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT SELECT ON public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.product_measures TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_measures TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Authenticated read product-media" ON storage.objects;
CREATE POLICY "Authenticated read product-media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Admins insert product-media" ON storage.objects;
CREATE POLICY "Admins insert product-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-media' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update product-media" ON storage.objects;
CREATE POLICY "Admins update product-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-media' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'product-media' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete product-media" ON storage.objects;
CREATE POLICY "Admins delete product-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-media' AND public.has_role(auth.uid(), 'admin'));
