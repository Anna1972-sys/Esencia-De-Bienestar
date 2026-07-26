CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  area text NOT NULL CHECK (area IN ('carga', 'supabase', 'recetas', 'aplicacion')),
  action text NOT NULL,
  message text NOT NULL,
  user_message text,
  path text,
  technical_detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS app_error_logs_created_at_idx
  ON public.app_error_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS app_error_logs_pending_idx
  ON public.app_error_logs (resolved_at, created_at DESC);

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_can_report_app_errors" ON public.app_error_logs;
CREATE POLICY "authenticated_can_report_app_errors"
  ON public.app_error_logs FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "admins_can_read_app_errors" ON public.app_error_logs;
CREATE POLICY "admins_can_read_app_errors"
  ON public.app_error_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins_can_update_app_errors" ON public.app_error_logs;
CREATE POLICY "admins_can_update_app_errors"
  ON public.app_error_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins_can_delete_app_errors" ON public.app_error_logs;
CREATE POLICY "admins_can_delete_app_errors"
  ON public.app_error_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE public.app_error_logs FROM anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.app_error_logs TO authenticated;
