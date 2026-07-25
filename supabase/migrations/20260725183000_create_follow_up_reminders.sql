BEGIN;

CREATE TABLE IF NOT EXISTS public.follow_up_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  note text NOT NULL,
  due_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS follow_up_reminders_due_idx
  ON public.follow_up_reminders (completed_at, due_at);

ALTER TABLE public.follow_up_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follow_up_reminders_admin_all" ON public.follow_up_reminders;
CREATE POLICY "follow_up_reminders_admin_all"
  ON public.follow_up_reminders
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "challenge_progress_admin_read" ON public.challenge_progress;
CREATE POLICY "challenge_progress_admin_read"
  ON public.challenge_progress
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.follow_up_reminders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_reminders TO authenticated;

COMMIT;
