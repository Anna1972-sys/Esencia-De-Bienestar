BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'client');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'invitation_status'
  ) THEN
    CREATE TYPE public.invitation_status AS ENUM ('pending', 'used', 'expired');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_wellness_entries_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  email text,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS token text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS status public.invitation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS used_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations(token);

CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  source_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text,
  categories text[],
  servings integer DEFAULT 1,
  prep_time integer,
  macros jsonb DEFAULT '{}'::jsonb,
  ingredients jsonb DEFAULT '[]'::jsonb,
  steps jsonb DEFAULT '[]'::jsonb,
  tags text[] DEFAULT '{}',
  image_url text,
  video_url text,
  is_library boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  is_high_protein boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS categories text[],
  ADD COLUMN IF NOT EXISTS servings integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prep_time integer,
  ADD COLUMN IF NOT EXISTS macros jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ingredients jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS steps jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS is_library boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_high_protein boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS recipes_library_idx ON public.recipes(is_library, is_featured, visibility);
CREATE INDEX IF NOT EXISTS recipes_user_idx ON public.recipes(user_id);

CREATE TABLE IF NOT EXISTS public.saved_recipes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE TABLE IF NOT EXISTS public.shopping_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shopping_categories
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS shopping_categories_name_idx ON public.shopping_categories(name);

CREATE TABLE IF NOT EXISTS public.shopping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shopping_templates
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS shopping_templates_category_idx ON public.shopping_templates(category);

CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity text,
  category text DEFAULT 'Otros',
  checked boolean NOT NULL DEFAULT false,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS quantity text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Otros',
  ADD COLUMN IF NOT EXISTS checked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS shopping_list_items_user_idx ON public.shopping_list_items(user_id);
CREATE INDEX IF NOT EXISTS shopping_list_items_category_idx ON public.shopping_list_items(category);

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  icon text,
  days jsonb NOT NULL DEFAULT '[]'::jsonb,
  extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS days jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.challenge_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  day integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id, day)
);

CREATE TABLE IF NOT EXISTS public.resource_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  icon text,
  parent_id uuid REFERENCES public.resource_categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_categories
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.resource_categories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS resource_categories_slug_idx ON public.resource_categories(slug);
CREATE INDEX IF NOT EXISTS idx_resource_categories_parent ON public.resource_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_resource_categories_sort ON public.resource_categories(sort_order);

CREATE TABLE IF NOT EXISTS public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'video',
  url text,
  category text,
  category_id uuid REFERENCES public.resource_categories(id) ON DELETE SET NULL,
  body text,
  cover_image text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.resource_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS cover_image text,
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_resources_category_id ON public.resources(category_id);
CREATE INDEX IF NOT EXISTS idx_resources_pinned_sort ON public.resources(is_pinned DESC, sort_order ASC);

CREATE TABLE IF NOT EXISTS public.wellness_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  water_glasses integer NOT NULL DEFAULT 0,
  water_ml integer NOT NULL DEFAULT 0,
  sleep_hours numeric,
  steps integer,
  mood text,
  notes text,
  habits jsonb NOT NULL DEFAULT '{}'::jsonb,
  measurements jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

ALTER TABLE public.wellness_entries
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS entry_date date,
  ADD COLUMN IF NOT EXISTS water_glasses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS water_ml integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sleep_hours numeric,
  ADD COLUMN IF NOT EXISTS steps integer,
  ADD COLUMN IF NOT EXISTS mood text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS habits jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS measurements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.wellness_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  target_value numeric,
  current_value numeric,
  unit text,
  achieved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wellness_goals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS target_value numeric,
  ADD COLUMN IF NOT EXISTS current_value numeric,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS achieved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.wellness_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric text NOT NULL,
  value numeric(7,2) NOT NULL,
  unit text NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wellness_measurements
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS metric text,
  ADD COLUMN IF NOT EXISTS value numeric(7,2),
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS measured_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS wellness_measurements_user_metric_idx ON public.wellness_measurements(user_id, metric, measured_at);

CREATE TABLE IF NOT EXISTS public.wellness_progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric text NOT NULL,
  kind text NOT NULL,
  image_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, metric, kind)
);

ALTER TABLE public.wellness_progress_photos
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS metric text,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  app_name text NOT NULL DEFAULT 'Esencia de Bienestar',
  logo_url text,
  primary_color text DEFAULT '#FF2D95',
  secondary_color text DEFAULT '#FFF7FA',
  accent_color text DEFAULT '#B85CFF',
  welcome_title text DEFAULT 'Bienvenida a Esencia de Bienestar',
  welcome_message text DEFAULT 'Tu espacio para cuidarte cada día.',
  recipe_generator_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS app_name text NOT NULL DEFAULT 'Esencia de Bienestar',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#FF2D95',
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#FFF7FA',
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#B85CFF',
  ADD COLUMN IF NOT EXISTS welcome_title text DEFAULT 'Bienvenida a Esencia de Bienestar',
  ADD COLUMN IF NOT EXISTS welcome_message text DEFAULT 'Tu espacio para cuidarte cada día.',
  ADD COLUMN IF NOT EXISTS recipe_generator_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.app_settings (id)
SELECT true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.app_settings
  WHERE id = true
);

CREATE TABLE IF NOT EXISTS public.internal_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  synonyms text[] NOT NULL DEFAULT '{}',
  base_quantity numeric NOT NULL DEFAULT 100,
  base_unit text NOT NULL DEFAULT 'g',
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

ALTER TABLE public.internal_foods
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS synonyms text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS base_quantity numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS base_unit text NOT NULL DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS calories numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS protein numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carbs numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fat numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiber numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Tabla interna',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS internal_foods_synonyms_idx ON public.internal_foods USING gin (synonyms);
CREATE INDEX IF NOT EXISTS internal_foods_active_idx ON public.internal_foods(is_active);

CREATE TABLE IF NOT EXISTS public.movement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  cover_image text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.movement_items
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS cover_image text,
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.nutrition_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  emoji text,
  subtitle text,
  image_url text,
  visible boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrition_categories
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS emoji text,
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS nutrition_categories_key_idx ON public.nutrition_categories(key);

CREATE TABLE IF NOT EXISTS public.nutrition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  category text,
  cover_image text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrition_items
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS cover_image text,
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS nutrition_items_category_idx ON public.nutrition_items(category);
CREATE INDEX IF NOT EXISTS nutrition_items_tags_idx ON public.nutrition_items USING gin (tags);

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

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS product_categories_slug_idx ON public.product_categories(slug);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  aliases text[] NOT NULL DEFAULT '{}',
  line text,
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
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  fiber numeric,
  sugars numeric,
  salt numeric,
  micronutrients jsonb DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'Pendiente de etiqueta oficial Herbalife España',
  verification_status text NOT NULL DEFAULT 'pendiente',
  nutrition_effective_from timestamptz DEFAULT now(),
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

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS line text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS gallery_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pdf_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS external_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS benefits text,
  ADD COLUMN IF NOT EXISTS usage text,
  ADD COLUMN IF NOT EXISTS ingredients_text text,
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS free_text text,
  ADD COLUMN IF NOT EXISTS calories numeric,
  ADD COLUMN IF NOT EXISTS protein numeric,
  ADD COLUMN IF NOT EXISTS carbs numeric,
  ADD COLUMN IF NOT EXISTS fat numeric,
  ADD COLUMN IF NOT EXISTS fiber numeric,
  ADD COLUMN IF NOT EXISTS sugars numeric,
  ADD COLUMN IF NOT EXISTS salt numeric,
  ADD COLUMN IF NOT EXISTS micronutrients jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Pendiente de etiqueta oficial Herbalife España',
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS nutrition_effective_from timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visible_to_clients boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_for_recipes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS informative_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS herbalife_spoon_measure_id uuid,
  ADD COLUMN IF NOT EXISTS spoon_image_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS products_slug_idx ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_visibility ON public.products(is_active, visible_to_clients, available_for_recipes);
CREATE INDEX IF NOT EXISTS idx_products_aliases ON public.products USING gin (aliases);

CREATE TABLE IF NOT EXISTS public.product_measures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  grams numeric,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  fiber numeric,
  source text NOT NULL DEFAULT 'Pendiente de etiqueta oficial Herbalife España',
  verification_status text NOT NULL DEFAULT 'pendiente',
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_measures
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS grams numeric,
  ADD COLUMN IF NOT EXISTS calories numeric,
  ADD COLUMN IF NOT EXISTS protein numeric,
  ADD COLUMN IF NOT EXISTS carbs numeric,
  ADD COLUMN IF NOT EXISTS fat numeric,
  ADD COLUMN IF NOT EXISTS fiber numeric,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Pendiente de etiqueta oficial Herbalife España',
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_product_measures_product ON public.product_measures(product_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_shopping_categories_updated'
  ) THEN
    CREATE TRIGGER trg_shopping_categories_updated
    BEFORE UPDATE ON public.shopping_categories
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_resource_categories_touch'
  ) THEN
    CREATE TRIGGER trg_resource_categories_touch
    BEFORE UPDATE ON public.resource_categories
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_movement_items_updated_at'
  ) THEN
    CREATE TRIGGER trg_movement_items_updated_at
    BEFORE UPDATE ON public.movement_items
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_internal_foods_updated_at'
  ) THEN
    CREATE TRIGGER update_internal_foods_updated_at
    BEFORE UPDATE ON public.internal_foods
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_nutrition_categories_updated_at'
  ) THEN
    CREATE TRIGGER update_nutrition_categories_updated_at
    BEFORE UPDATE ON public.nutrition_categories
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_nutrition_items_updated_at'
  ) THEN
    CREATE TRIGGER trg_nutrition_items_updated_at
    BEFORE UPDATE ON public.nutrition_items
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_measures ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_recipes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_list_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_measurements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_progress_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_foods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movement_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_measures TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_read_all" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_read_all" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "roles_self_read" ON public.user_roles;
DROP POLICY IF EXISTS "roles_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_writes_admin_only" ON public.user_roles;
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "invitations_admin_all" ON public.invitations;
DROP POLICY IF EXISTS "invitations_admin_select" ON public.invitations;
DROP POLICY IF EXISTS "invitations_admin_insert" ON public.invitations;
DROP POLICY IF EXISTS "invitations_admin_update" ON public.invitations;
DROP POLICY IF EXISTS "invitations_admin_delete" ON public.invitations;
CREATE POLICY "invitations_admin_select" ON public.invitations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "invitations_admin_insert" ON public.invitations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "invitations_admin_update" ON public.invitations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "invitations_admin_delete" ON public.invitations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "recipes_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_library_read" ON public.recipes;
DROP POLICY IF EXISTS "recipes_admin_all" ON public.recipes;
DROP POLICY IF EXISTS "recipes_shared_read" ON public.recipes;
DROP POLICY IF EXISTS "recipes_non_admin_visibility_lock" ON public.recipes;
CREATE POLICY "recipes_own" ON public.recipes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND COALESCE(is_library, false) = false);
CREATE POLICY "recipes_shared_read" ON public.recipes FOR SELECT TO authenticated USING (is_library = true OR visibility IN ('community', 'featured') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "recipes_admin_all" ON public.recipes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "saved_own" ON public.saved_recipes;
CREATE POLICY "saved_own" ON public.saved_recipes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopping_own" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_items_admin_read" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_items_admin_update" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_items_admin_delete" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Authenticated can read admin shopping items" ON public.shopping_list_items;
CREATE POLICY "shopping_own" ON public.shopping_list_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shopping_items_admin_read" ON public.shopping_list_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "shopping_items_admin_update" ON public.shopping_list_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "shopping_items_admin_delete" ON public.shopping_list_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read shopping categories" ON public.shopping_categories;
DROP POLICY IF EXISTS "Admins manage shopping categories" ON public.shopping_categories;
CREATE POLICY "Authenticated can read shopping categories" ON public.shopping_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage shopping categories" ON public.shopping_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "shop_tpl_read" ON public.shopping_templates;
DROP POLICY IF EXISTS "shop_tpl_admin_write" ON public.shopping_templates;
DROP POLICY IF EXISTS "shopping_templates_authenticated_read" ON public.shopping_templates;
CREATE POLICY "shopping_templates_authenticated_read" ON public.shopping_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "shop_tpl_admin_write" ON public.shopping_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "challenges_read" ON public.challenges;
DROP POLICY IF EXISTS "challenges_admin" ON public.challenges;
CREATE POLICY "challenges_read" ON public.challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "challenges_admin" ON public.challenges FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "progress_own" ON public.challenge_progress;
CREATE POLICY "progress_own" ON public.challenge_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone authenticated can view categories" ON public.resource_categories;
DROP POLICY IF EXISTS "Admins manage categories" ON public.resource_categories;
CREATE POLICY "Anyone authenticated can view categories" ON public.resource_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.resource_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "resources_read" ON public.resources;
DROP POLICY IF EXISTS "resources_admin" ON public.resources;
CREATE POLICY "resources_read" ON public.resources FOR SELECT TO authenticated USING (is_published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "resources_admin" ON public.resources FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users manage own wellness entries" ON public.wellness_entries;
DROP POLICY IF EXISTS "Admins can view all wellness entries" ON public.wellness_entries;
CREATE POLICY "Users manage own wellness entries" ON public.wellness_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all wellness entries" ON public.wellness_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users manage own wellness goals" ON public.wellness_goals;
DROP POLICY IF EXISTS "Admins can view all wellness goals" ON public.wellness_goals;
CREATE POLICY "Users manage own wellness goals" ON public.wellness_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all wellness goals" ON public.wellness_goals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users manage own measurements" ON public.wellness_measurements;
DROP POLICY IF EXISTS "Admins can view all wellness measurements" ON public.wellness_measurements;
CREATE POLICY "Users manage own measurements" ON public.wellness_measurements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all wellness measurements" ON public.wellness_measurements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users manage own progress photos" ON public.wellness_progress_photos;
DROP POLICY IF EXISTS "Admins can view all wellness progress photos" ON public.wellness_progress_photos;
CREATE POLICY "Users manage own progress photos" ON public.wellness_progress_photos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all wellness progress photos" ON public.wellness_progress_photos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "settings_read" ON public.app_settings;
DROP POLICY IF EXISTS "settings_read_authenticated" ON public.app_settings;
DROP POLICY IF EXISTS "settings_admin_write" ON public.app_settings;
CREATE POLICY "settings_read_authenticated" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read active internal foods" ON public.internal_foods;
DROP POLICY IF EXISTS "Admins can manage internal foods" ON public.internal_foods;
DROP POLICY IF EXISTS "internal_foods_authenticated_read" ON public.internal_foods;
CREATE POLICY "Authenticated can read active internal foods" ON public.internal_foods FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage internal foods" ON public.internal_foods FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can view movement items" ON public.movement_items;
DROP POLICY IF EXISTS "Admins can insert movement items" ON public.movement_items;
DROP POLICY IF EXISTS "Admins can update movement items" ON public.movement_items;
DROP POLICY IF EXISTS "Admins can delete movement items" ON public.movement_items;
CREATE POLICY "Authenticated can view movement items" ON public.movement_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert movement items" ON public.movement_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update movement items" ON public.movement_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete movement items" ON public.movement_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read nutrition categories" ON public.nutrition_categories;
DROP POLICY IF EXISTS "Admins can manage nutrition categories" ON public.nutrition_categories;
CREATE POLICY "Authenticated can read nutrition categories" ON public.nutrition_categories FOR SELECT TO authenticated USING (visible = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage nutrition categories" ON public.nutrition_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can view nutrition items" ON public.nutrition_items;
DROP POLICY IF EXISTS "Admins can insert nutrition items" ON public.nutrition_items;
DROP POLICY IF EXISTS "Admins can update nutrition items" ON public.nutrition_items;
DROP POLICY IF EXISTS "Admins can delete nutrition items" ON public.nutrition_items;
CREATE POLICY "Authenticated can view nutrition items" ON public.nutrition_items FOR SELECT TO authenticated USING (visible = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert nutrition items" ON public.nutrition_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update nutrition items" ON public.nutrition_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete nutrition items" ON public.nutrition_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "product_categories_authenticated_read" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_admin_manage" ON public.product_categories;
CREATE POLICY "product_categories_authenticated_read" ON public.product_categories FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "product_categories_admin_manage" ON public.product_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "products_authenticated_read" ON public.products;
DROP POLICY IF EXISTS "products_admin_manage" ON public.products;
CREATE POLICY "products_authenticated_read" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR (is_active = true AND (visible_to_clients = true OR available_for_recipes = true)));
CREATE POLICY "products_admin_manage" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "product_measures_authenticated_read" ON public.product_measures;
DROP POLICY IF EXISTS "product_measures_admin_manage" ON public.product_measures;
CREATE POLICY "product_measures_authenticated_read" ON public.product_measures FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = product_measures.product_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (p.is_active = true AND (p.visible_to_clients = true OR p.available_for_recipes = true))
      )
  )
);
CREATE POLICY "product_measures_admin_manage" ON public.product_measures FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.shopping_categories (name, sort_order)
SELECT v.name, v.sort_order
FROM (
  SELECT 'Proteínas'::text AS name, 10::integer AS sort_order
  UNION ALL SELECT 'Carne'::text, 20::integer
  UNION ALL SELECT 'Pescado'::text, 30::integer
  UNION ALL SELECT 'Huevos'::text, 40::integer
  UNION ALL SELECT 'Verduras'::text, 50::integer
  UNION ALL SELECT 'Frutas'::text, 60::integer
  UNION ALL SELECT 'Cereales'::text, 70::integer
  UNION ALL SELECT 'Legumbres'::text, 80::integer
  UNION ALL SELECT 'Lácteos'::text, 90::integer
  UNION ALL SELECT 'Semillas y frutos secos'::text, 100::integer
  UNION ALL SELECT 'Grasas saludables'::text, 110::integer
  UNION ALL SELECT 'Bebidas'::text, 120::integer
  UNION ALL SELECT 'Otros'::text, 999::integer
) AS v
WHERE NOT EXISTS (
  SELECT 1
  FROM public.shopping_categories existing
  WHERE existing.name = v.name
);

INSERT INTO public.resource_categories (name, slug, icon, sort_order)
SELECT v.name, v.slug, v.icon, v.sort_order
FROM (
  SELECT 'Imprescindibles'::text AS name, 'imprescindibles'::text AS slug, '⭐'::text AS icon, 1::integer AS sort_order
  UNION ALL SELECT 'Educación nutricional'::text, 'educacion'::text, '📚'::text, 2::integer
  UNION ALL SELECT 'Alimentación saludable'::text, 'alimentacion'::text, '🥗'::text, 3::integer
  UNION ALL SELECT 'Pérdida de peso'::text, 'perdida-peso'::text, '⚖️'::text, 4::integer
  UNION ALL SELECT 'Mentalidad y hábitos'::text, 'mentalidad'::text, '🧠'::text, 5::integer
  UNION ALL SELECT 'Vídeos'::text, 'videos'::text, '🎥'::text, 6::integer
  UNION ALL SELECT 'Guías y recursos'::text, 'guias'::text, '📄'::text, 7::integer
) AS v
WHERE NOT EXISTS (
  SELECT 1
  FROM public.resource_categories existing
  WHERE existing.slug = v.slug
);

INSERT INTO public.nutrition_categories (key, label, emoji, subtitle, sort_order, visible)
SELECT v.key, v.label, v.emoji, v.subtitle, v.sort_order, v.visible
FROM (
  SELECT 'proteinas'::text AS key, 'Nutrición'::text AS label, '🥚'::text AS emoji, 'Bases para cuidar tu rendimiento.'::text AS subtitle, 1::integer AS sort_order, true::boolean AS visible
  UNION ALL SELECT 'pre-entreno'::text, 'Preentrenamiento'::text, '⚡'::text, 'Energía antes de entrenar.'::text, 2::integer, true::boolean
  UNION ALL SELECT 'entrenamiento'::text, 'Entrenamiento'::text, '🏋️'::text, 'Apoyo durante la sesión.'::text, 3::integer, true::boolean
  UNION ALL SELECT 'post-entreno'::text, 'Recuperación postentrenamiento'::text, '🌿'::text, 'Recupera mejor después del esfuerzo.'::text, 4::integer, true::boolean
  UNION ALL SELECT 'ganancia-masa-muscular'::text, 'Ganancia de masa muscular'::text, '💪'::text, 'Proteína, fuerza y progreso.'::text, 5::integer, true::boolean
  UNION ALL SELECT 'perdida-grasa'::text, 'Pérdida de grasa'::text, '🔥'::text, 'Estrategias para definir con equilibrio.'::text, 6::integer, true::boolean
  UNION ALL SELECT 'resistencia'::text, 'Resistencia'::text, '🏃'::text, 'Energía sostenida y fondo físico.'::text, 7::integer, true::boolean
  UNION ALL SELECT 'hidratacion'::text, 'Hidratación'::text, '💧'::text, 'Agua, sales y equilibrio diario.'::text, 8::integer, true::boolean
  UNION ALL SELECT 'suplementacion'::text, 'Suplementación deportiva'::text, '💊'::text, 'Productos y guías de uso.'::text, 9::integer, true::boolean
  UNION ALL SELECT 'recetas'::text, 'Recetas deportivas'::text, '🍓'::text, 'Ideas prácticas para entrenar mejor.'::text, 10::integer, true::boolean
  UNION ALL SELECT 'planes'::text, 'Guías y vídeos'::text, '🎥'::text, 'Aprende con recursos visuales.'::text, 11::integer, true::boolean
  UNION ALL SELECT 'protocolos'::text, 'Protocolos'::text, '📋'::text, 'Pautas para objetivos concretos.'::text, 12::integer, true::boolean
) AS v
WHERE NOT EXISTS (
  SELECT 1
  FROM public.nutrition_categories existing
  WHERE existing.key = v.key
);

INSERT INTO public.product_categories (name, slug, description, sort_order, is_active)
SELECT v.name, v.slug, v.description, v.sort_order, v.is_active
FROM (
  SELECT 'Control de peso'::text AS name, 'control-de-peso'::text AS slug, 'Productos para control de peso y batidos.'::text AS description, 10::integer AS sort_order, true::boolean AS is_active
  UNION ALL SELECT 'Nutrición deportiva'::text, 'nutricion-deportiva-productos'::text, 'Productos de apoyo deportivo.'::text, 20::integer, true::boolean
  UNION ALL SELECT 'Nutrición y salud'::text, 'nutricion-y-salud-productos'::text, 'Productos de apoyo nutricional general.'::text, 30::integer, true::boolean
  UNION ALL SELECT 'Hidratación y energía'::text, 'hidratacion-y-energia'::text, 'Bebidas, hidratación y energía.'::text, 40::integer, true::boolean
  UNION ALL SELECT 'Bienestar digestivo'::text, 'bienestar-digestivo'::text, 'Productos de aloe y apoyo digestivo.'::text, 50::integer, true::boolean
) AS v
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_categories existing
  WHERE existing.slug = v.slug
);

WITH seed_products AS (
  SELECT 'Fórmula 1'::text AS name, 'formula-1'::text AS slug, 'Control de peso'::text AS line, 'control-de-peso'::text AS category_slug, ARRAY['F1','Formula 1','Fórmula Uno','Formula Uno','Batido Herbalife','Batido Fórmula 1','Batido Formula 1','F1 vainilla']::text[] AS aliases, true::boolean AS visible_to_clients, true::boolean AS available_for_recipes, 'Pendiente de etiqueta oficial Herbalife España. Medidas de cuchara basadas en imagen aportada por administración.'::text AS source, 'pendiente'::text AS verification_status, 10::integer AS sort_order
  UNION ALL SELECT 'PDM'::text, 'pdm'::text, 'Control de peso'::text, 'control-de-peso'::text, ARRAY['Protein Drink Mix','Proteína Drink Mix','Bebida de proteína','PDM Herbalife']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España. Medidas de cuchara basadas en imagen aportada por administración.'::text, 'pendiente'::text, 20::integer
  UNION ALL SELECT 'PPP'::text, 'ppp'::text, 'Nutrición deportiva'::text, 'nutricion-deportiva-productos'::text, ARRAY['Proteína Personalizada','Proteina Personalizada','Personalized Protein Powder','PPP Herbalife']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España. Medida de cuchara basada en imagen aportada por administración.'::text, 'pendiente'::text, 30::integer
  UNION ALL SELECT 'Beta Heart'::text, 'beta-heart'::text, 'Nutrición y salud'::text, 'nutricion-y-salud-productos'::text, ARRAY['Betta Heart','BetaHeart','Beta-Heart']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 40::integer
  UNION ALL SELECT 'Colágeno'::text, 'colageno'::text, 'Nutrición y salud'::text, 'nutricion-y-salud-productos'::text, ARRAY['Collagen','Colageno','Colágeno Herbalife','Collagen Skin Booster']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 50::integer
  UNION ALL SELECT 'Concentrado de hierbas'::text, 'concentrado-de-hierbas'::text, 'Hidratación y energía'::text, 'hidratacion-y-energia'::text, ARRAY['HTC','Té Herbalife','Te Herbalife','Concentrado de Hierbas Té','Concentrado de Hierbas Te','Herbal Tea Concentrate']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España. Medida de cuchara basada en imagen aportada por administración.'::text, 'pendiente'::text, 60::integer
  UNION ALL SELECT 'Aloe Max'::text, 'aloe-max'::text, 'Bienestar digestivo'::text, 'bienestar-digestivo'::text, ARRAY['AloeMax','Aloe Herbalife Max']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 70::integer
  UNION ALL SELECT 'Aloe Mango'::text, 'aloe-mango'::text, 'Bienestar digestivo'::text, 'bienestar-digestivo'::text, ARRAY['Aloe sabor mango','Aloe Herbalife Mango','Herbal Aloe Mango']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 80::integer
  UNION ALL SELECT 'CR7'::text, 'cr7'::text, 'Hidratación y energía'::text, 'hidratacion-y-energia'::text, ARRAY['CR7 Drive','Cristiano Ronaldo Drink','Bebida CR7']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 90::integer
  UNION ALL SELECT 'Prolong'::text, 'prolong'::text, 'Nutrición deportiva'::text, 'nutricion-deportiva-productos'::text, ARRAY['H24 Prolong','Herbalife24 Prolong']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 100::integer
  UNION ALL SELECT 'Rebuild Strength'::text, 'rebuild-strength'::text, 'Nutrición deportiva'::text, 'nutricion-deportiva-productos'::text, ARRAY['H24 Rebuild Strength','Herbalife24 Rebuild Strength','Rebuild']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 110::integer
  UNION ALL SELECT 'Liftoff'::text, 'liftoff'::text, 'Hidratación y energía'::text, 'hidratacion-y-energia'::text, ARRAY['Lift Off','Herbalife Liftoff','Energía Herbalife','Energia Herbalife']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 120::integer
  UNION ALL SELECT 'Barritas H24'::text, 'barritas-h24'::text, 'Nutrición deportiva'::text, 'nutricion-deportiva-productos'::text, ARRAY['H24 Bar','Barrita H24','Barritas Herbalife24']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 130::integer
  UNION ALL SELECT 'Barritas Fórmula 1'::text, 'barritas-formula-1'::text, 'Control de peso'::text, 'control-de-peso'::text, ARRAY['Barrita Fórmula 1','Barritas Formula 1','Barrita Formula 1','F1 Express Bar']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 140::integer
  UNION ALL SELECT 'Barritas Snacks'::text, 'barritas-snacks'::text, 'Control de peso'::text, 'control-de-peso'::text, ARRAY['Snack Bar','Barrita Snack','Barritas snack Herbalife']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 150::integer
  UNION ALL SELECT 'Hydrate'::text, 'hydrate'::text, 'Hidratación y energía'::text, 'hidratacion-y-energia'::text, ARRAY['H24 Hydrate','Herbalife24 Hydrate','Bebida Hydrate']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 160::integer
  UNION ALL SELECT 'Avena Manzana y Fibra'::text, 'avena-manzana-y-fibra'::text, 'Control de peso'::text, 'control-de-peso'::text, ARRAY['Avena Manzana Fibra','Oat Apple Fibre','Avena y fibra']::text[], true::boolean, true::boolean, 'Pendiente de etiqueta oficial Herbalife España.'::text, 'pendiente'::text, 170::integer
)
INSERT INTO public.products (
  name,
  slug,
  line,
  category_id,
  aliases,
  visible_to_clients,
  available_for_recipes,
  source,
  verification_status,
  sort_order,
  is_active,
  informative_only
)
SELECT
  p.name,
  p.slug,
  p.line,
  c.id,
  p.aliases,
  p.visible_to_clients,
  p.available_for_recipes,
  p.source,
  p.verification_status,
  p.sort_order,
  true,
  false
FROM seed_products p
JOIN public.product_categories c ON c.slug = p.category_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM public.products existing
  WHERE existing.slug = p.slug
);

WITH spoon_measures AS (
  SELECT 'formula-1'::text AS product_slug, '1 cuchara rasa grande Herbalife'::text AS measure_name, 14::numeric AS grams, 'Medida de cuchara oficial aportada por administración.'::text AS source, 'pendiente'::text AS verification_status, true::boolean AS is_default, 10::integer AS sort_order
  UNION ALL SELECT 'formula-1'::text, '2 cucharas rasas grandes Herbalife'::text, 28::numeric, 'Medida de cuchara oficial aportada por administración.'::text, 'pendiente'::text, false::boolean, 20::integer
  UNION ALL SELECT 'pdm'::text, '1 cuchara rasa grande Herbalife'::text, 14::numeric, 'Medida de cuchara oficial aportada por administración.'::text, 'pendiente'::text, true::boolean, 10::integer
  UNION ALL SELECT 'pdm'::text, '2 cucharas rasas grandes Herbalife'::text, 28::numeric, 'Medida de cuchara oficial aportada por administración.'::text, 'pendiente'::text, false::boolean, 20::integer
  UNION ALL SELECT 'ppp'::text, '1 cuchara rasa pequeña Herbalife'::text, 6::numeric, 'Medida de cuchara oficial aportada por administración.'::text, 'pendiente'::text, true::boolean, 10::integer
  UNION ALL SELECT 'concentrado-de-hierbas'::text, '1 cuchara rasa inferior grande Herbalife'::text, 1.7::numeric, 'Medida de cuchara oficial aportada por administración.'::text, 'pendiente'::text, true::boolean, 10::integer
)
INSERT INTO public.product_measures (
  product_id,
  name,
  grams,
  source,
  verification_status,
  is_default,
  sort_order
)
SELECT
  p.id,
  m.measure_name,
  m.grams,
  m.source,
  m.verification_status,
  m.is_default,
  m.sort_order
FROM spoon_measures m
JOIN public.products p ON p.slug = m.product_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_measures existing
  WHERE existing.product_id = p.id
    AND existing.name = m.measure_name
);

INSERT INTO storage.buckets (id, name, public)
SELECT b.id, b.name, b.public
FROM (
  SELECT 'recipe-images'::text AS id, 'recipe-images'::text AS name, true::boolean AS public
  UNION ALL SELECT 'resource-media'::text, 'resource-media'::text, true::boolean
  UNION ALL SELECT 'product-media'::text, 'product-media'::text, true::boolean
  UNION ALL SELECT 'challenge-media'::text, 'challenge-media'::text, true::boolean
  UNION ALL SELECT 'progress-photos'::text, 'progress-photos'::text, false::boolean
) AS b
WHERE NOT EXISTS (
  SELECT 1
  FROM storage.buckets existing
  WHERE existing.id = b.id
);

COMMIT;
