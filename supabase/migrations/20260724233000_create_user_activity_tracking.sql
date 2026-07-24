CREATE TABLE IF NOT EXISTS public.user_activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  category text NOT NULL,
  label text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  active_seconds integer NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_activity_sessions_user_started_idx
  ON public.user_activity_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS user_activity_sessions_user_category_idx
  ON public.user_activity_sessions (user_id, category);

ALTER TABLE public.user_activity_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_activity_admin_read" ON public.user_activity_sessions;
CREATE POLICY "user_activity_admin_read"
  ON public.user_activity_sessions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_activity_admin_delete" ON public.user_activity_sessions;
CREATE POLICY "user_activity_admin_delete"
  ON public.user_activity_sessions
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_user_activity(
  p_session_id uuid,
  p_path text,
  p_category text,
  p_label text,
  p_active_seconds integer,
  p_started_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.user_activity_sessions (
    session_id,
    user_id,
    path,
    category,
    label,
    active_seconds,
    started_at,
    last_seen_at,
    updated_at
  )
  VALUES (
    p_session_id,
    current_user_id,
    left(coalesce(nullif(trim(p_path), ''), '/app'), 300),
    left(coalesce(nullif(trim(p_category), ''), 'Otra sección'), 120),
    left(nullif(trim(p_label), ''), 180),
    greatest(0, least(coalesce(p_active_seconds, 0), 86400)),
    least(coalesce(p_started_at, now()), now()),
    now(),
    now()
  )
  ON CONFLICT (session_id) DO UPDATE
  SET
    path = EXCLUDED.path,
    category = EXCLUDED.category,
    label = coalesce(EXCLUDED.label, public.user_activity_sessions.label),
    active_seconds = greatest(
      public.user_activity_sessions.active_seconds,
      EXCLUDED.active_seconds
    ),
    last_seen_at = now(),
    updated_at = now()
  WHERE public.user_activity_sessions.user_id = current_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_user_activity(uuid, text, text, text, integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_user_activity(uuid, text, text, text, integer, timestamptz) TO authenticated;

REVOKE ALL ON TABLE public.user_activity_sessions FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.user_activity_sessions FROM authenticated;
