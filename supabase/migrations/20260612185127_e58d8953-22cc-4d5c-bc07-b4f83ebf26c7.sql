
-- Fix invitations: explicit deny SELECT to non-admins by creating admin-only SELECT, and ensure no anon
DROP POLICY IF EXISTS "invitations_admin_all" ON public.invitations;
CREATE POLICY "invitations_admin_select" ON public.invitations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "invitations_admin_insert" ON public.invitations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "invitations_admin_update" ON public.invitations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "invitations_admin_delete" ON public.invitations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
REVOKE SELECT ON public.invitations FROM anon;

-- Restrict diary_questions SELECT to authenticated
DROP POLICY IF EXISTS "diary_questions_select_all" ON public.diary_questions;
DROP POLICY IF EXISTS "Anyone can view active diary questions" ON public.diary_questions;
DROP POLICY IF EXISTS "diary_questions_public_read" ON public.diary_questions;
CREATE POLICY "diary_questions_authenticated_read" ON public.diary_questions FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
REVOKE SELECT ON public.diary_questions FROM anon;

-- Restrict progress_metrics SELECT to authenticated
DROP POLICY IF EXISTS "progress_metrics_select_all" ON public.progress_metrics;
DROP POLICY IF EXISTS "Anyone can view active metrics" ON public.progress_metrics;
DROP POLICY IF EXISTS "progress_metrics_public_read" ON public.progress_metrics;
CREATE POLICY "progress_metrics_authenticated_read" ON public.progress_metrics FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
REVOKE SELECT ON public.progress_metrics FROM anon;

-- Restrict shopping_templates SELECT to authenticated
DROP POLICY IF EXISTS "shopping_templates_select_all" ON public.shopping_templates;
DROP POLICY IF EXISTS "Anyone can view shopping templates" ON public.shopping_templates;
DROP POLICY IF EXISTS "shopping_templates_public_read" ON public.shopping_templates;
CREATE POLICY "shopping_templates_authenticated_read" ON public.shopping_templates FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.shopping_templates FROM anon;

-- Recipe images storage: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Recipe images viewable by everyone" ON storage.objects;
CREATE POLICY "Recipe images viewable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-images');

-- Lock down has_role SECURITY DEFINER function: revoke EXECUTE from public/anon/authenticated
-- RLS policies still call it as the function owner; only direct API calls are blocked.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
