ALTER TABLE public.nutrition_categories
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

ALTER TABLE public.nutrition_items
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

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
