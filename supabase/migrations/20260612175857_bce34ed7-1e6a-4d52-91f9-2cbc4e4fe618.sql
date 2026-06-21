
-- App settings singleton
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  app_name text NOT NULL DEFAULT 'Esencia de Bienestar',
  logo_url text,
  primary_color text DEFAULT '#D9A6B3',
  secondary_color text DEFAULT '#F4E7E1',
  accent_color text DEFAULT '#C8B6E2',
  welcome_title text DEFAULT 'Bienvenida a Esencia de Bienestar',
  welcome_message text DEFAULT 'Tu espacio para cuidarte cada día.',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_read" ON public.app_settings;
DROP POLICY IF EXISTS "settings_admin_write" ON public.app_settings;
CREATE POLICY "settings_read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- Shopping templates (admin curated suggestions)
CREATE TABLE IF NOT EXISTS public.shopping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shopping_templates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shopping_templates TO authenticated;
GRANT ALL ON public.shopping_templates TO service_role;
ALTER TABLE public.shopping_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop_tpl_read" ON public.shopping_templates;
DROP POLICY IF EXISTS "shop_tpl_admin_write" ON public.shopping_templates;
CREATE POLICY "shop_tpl_read" ON public.shopping_templates FOR SELECT USING (true);
CREATE POLICY "shop_tpl_admin_write" ON public.shopping_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Diary questions
CREATE TABLE IF NOT EXISTS public.diary_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  hint text,
  field_type text NOT NULL DEFAULT 'text',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.diary_questions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.diary_questions TO authenticated;
GRANT ALL ON public.diary_questions TO service_role;
ALTER TABLE public.diary_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "diary_q_read" ON public.diary_questions;
DROP POLICY IF EXISTS "diary_q_admin_write" ON public.diary_questions;
CREATE POLICY "diary_q_read" ON public.diary_questions FOR SELECT USING (true);
CREATE POLICY "diary_q_admin_write" ON public.diary_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Progress metrics
CREATE TABLE IF NOT EXISTS public.progress_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  unit text,
  target_value numeric,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.progress_metrics TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.progress_metrics TO authenticated;
GRANT ALL ON public.progress_metrics TO service_role;
ALTER TABLE public.progress_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prog_metrics_read" ON public.progress_metrics;
DROP POLICY IF EXISTS "prog_metrics_admin_write" ON public.progress_metrics;
CREATE POLICY "prog_metrics_read" ON public.progress_metrics FOR SELECT USING (true);
CREATE POLICY "prog_metrics_admin_write" ON public.progress_metrics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all profiles for user management
DROP POLICY IF EXISTS "profiles_admin_read_all" ON public.profiles;
CREATE POLICY "profiles_admin_read_all" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage roles
DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
