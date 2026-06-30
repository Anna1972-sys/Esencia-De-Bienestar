BEGIN;

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

ALTER TABLE public.nutrition_categories
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

ALTER TABLE public.nutrition_items
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS nutrition_items_tags_idx
  ON public.nutrition_items USING gin (tags);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_nutrition_categories_updated_at'
  ) THEN
    CREATE TRIGGER update_nutrition_categories_updated_at
    BEFORE UPDATE ON public.nutrition_categories
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_nutrition_items_updated_at'
  ) THEN
    CREATE TRIGGER trg_nutrition_items_updated_at
    BEFORE UPDATE ON public.nutrition_items
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.nutrition_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.nutrition_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.nutrition_categories TO authenticated;
GRANT ALL ON public.nutrition_categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_items TO authenticated;
GRANT ALL ON public.nutrition_items TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nutrition_categories'
      AND policyname = 'Authenticated can read nutrition categories'
  ) THEN
    CREATE POLICY "Authenticated can read nutrition categories"
    ON public.nutrition_categories
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nutrition_categories'
      AND policyname = 'Admins can manage nutrition categories'
  ) THEN
    CREATE POLICY "Admins can manage nutrition categories"
    ON public.nutrition_categories
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nutrition_items'
      AND policyname = 'Authenticated can view nutrition items'
  ) THEN
    CREATE POLICY "Authenticated can view nutrition items"
    ON public.nutrition_items
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nutrition_items'
      AND policyname = 'Admins can insert nutrition items'
  ) THEN
    CREATE POLICY "Admins can insert nutrition items"
    ON public.nutrition_items
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nutrition_items'
      AND policyname = 'Admins can update nutrition items'
  ) THEN
    CREATE POLICY "Admins can update nutrition items"
    ON public.nutrition_items
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nutrition_items'
      AND policyname = 'Admins can delete nutrition items'
  ) THEN
    CREATE POLICY "Admins can delete nutrition items"
    ON public.nutrition_items
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;

INSERT INTO public.nutrition_categories (key, label, emoji, subtitle, sort_order, visible)
VALUES
  ('proteinas', 'Nutrición', '🥚', 'Bases para cuidar tu rendimiento.', 1, true),
  ('pre-entreno', 'Preentrenamiento', '⚡', 'Energía antes de entrenar.', 2, true),
  ('entrenamiento', 'Entrenamiento', '🏋️', 'Apoyo durante la sesión.', 3, true),
  ('post-entreno', 'Recuperación postentrenamiento', '🌿', 'Recupera mejor después del esfuerzo.', 4, true),
  ('ganancia-masa-muscular', 'Ganancia de masa muscular', '💪', 'Proteína, fuerza y progreso.', 5, true),
  ('perdida-grasa', 'Pérdida de grasa', '🔥', 'Estrategias para definir con equilibrio.', 6, true),
  ('resistencia', 'Resistencia', '🏃', 'Energía sostenida y fondo físico.', 7, true),
  ('hidratacion', 'Hidratación', '💧', 'Agua, sales y equilibrio diario.', 8, true),
  ('suplementacion', 'Suplementación deportiva', '💊', 'Productos y guías de uso.', 9, true),
  ('recetas', 'Recetas deportivas', '🍓', 'Ideas prácticas para entrenar mejor.', 10, true),
  ('planes', 'Guías y vídeos', '🎥', 'Aprende con recursos visuales.', 11, true),
  ('protocolos', 'Protocolos', '📋', 'Pautas para objetivos concretos.', 12, true)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  emoji = EXCLUDED.emoji,
  subtitle = EXCLUDED.subtitle,
  sort_order = EXCLUDED.sort_order,
  visible = EXCLUDED.visible;

COMMIT;
