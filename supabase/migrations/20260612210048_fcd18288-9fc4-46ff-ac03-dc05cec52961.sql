-- Restrict public read access for invite-only app
DROP POLICY IF EXISTS "settings_read" ON public.app_settings;
CREATE POLICY "settings_read_authenticated" ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "diary_q_read" ON public.diary_questions;

DROP POLICY IF EXISTS "prog_metrics_read" ON public.progress_metrics;

DROP POLICY IF EXISTS "shop_tpl_read" ON public.shopping_templates;

-- Revoke anon SELECT grants on those tables (authenticated grants remain)
REVOKE SELECT ON public.app_settings FROM anon;
REVOKE SELECT ON public.diary_questions FROM anon;
REVOKE SELECT ON public.progress_metrics FROM anon;
REVOKE SELECT ON public.shopping_templates FROM anon;
