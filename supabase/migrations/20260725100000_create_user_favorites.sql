CREATE TABLE IF NOT EXISTS public.user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('recipe', 'video', 'guide', 'exercise')),
  content_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0 CHECK (open_count >= 0),
  UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS user_favorites_user_created_idx
  ON public.user_favorites (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_favorites_content_idx
  ON public.user_favorites (content_type, content_id);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_select_own_or_admin" ON public.user_favorites;
CREATE POLICY "favorites_select_own_or_admin"
  ON public.user_favorites FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "favorites_insert_own" ON public.user_favorites;
CREATE POLICY "favorites_insert_own"
  ON public.user_favorites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_delete_own" ON public.user_favorites;
CREATE POLICY "favorites_delete_own"
  ON public.user_favorites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.favorite_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('recipe', 'video', 'guide', 'exercise')),
  content_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('added', 'removed', 'opened')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS favorite_activity_user_created_idx
  ON public.favorite_activity_events (user_id, created_at DESC);

ALTER TABLE public.favorite_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorite_activity_admin_read" ON public.favorite_activity_events;
CREATE POLICY "favorite_activity_admin_read"
  ON public.favorite_activity_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_favorite_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.content_type = 'recipe' AND NOT EXISTS (
    SELECT 1 FROM public.recipes WHERE id = NEW.content_id
  ) THEN
    RAISE EXCEPTION 'Recipe not found';
  ELSIF NEW.content_type IN ('video', 'guide') AND NOT EXISTS (
    SELECT 1 FROM public.resources WHERE id = NEW.content_id
  ) THEN
    RAISE EXCEPTION 'Resource not found';
  ELSIF NEW.content_type = 'exercise' AND NOT EXISTS (
    SELECT 1 FROM public.movement_items WHERE id = NEW.content_id
  ) THEN
    RAISE EXCEPTION 'Exercise not found';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_favorite_content_trigger ON public.user_favorites;
CREATE TRIGGER validate_favorite_content_trigger
  BEFORE INSERT ON public.user_favorites
  FOR EACH ROW EXECUTE FUNCTION public.validate_favorite_content();

CREATE OR REPLACE FUNCTION public.record_favorite_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.favorite_activity_events (user_id, content_type, content_id, action)
    VALUES (NEW.user_id, NEW.content_type, NEW.content_id, 'added');
    RETURN NEW;
  END IF;

  INSERT INTO public.favorite_activity_events (user_id, content_type, content_id, action)
  VALUES (OLD.user_id, OLD.content_type, OLD.content_id, 'removed');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS record_favorite_insert_trigger ON public.user_favorites;
CREATE TRIGGER record_favorite_insert_trigger
  AFTER INSERT ON public.user_favorites
  FOR EACH ROW EXECUTE FUNCTION public.record_favorite_change();

DROP TRIGGER IF EXISTS record_favorite_delete_trigger ON public.user_favorites;
CREATE TRIGGER record_favorite_delete_trigger
  AFTER DELETE ON public.user_favorites
  FOR EACH ROW EXECUTE FUNCTION public.record_favorite_change();

CREATE OR REPLACE FUNCTION public.mark_favorite_opened(
  p_content_type text,
  p_content_id uuid
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

  UPDATE public.user_favorites
  SET
    open_count = open_count + 1,
    last_opened_at = now()
  WHERE user_id = current_user_id
    AND content_type = p_content_type
    AND content_id = p_content_id;

  IF FOUND THEN
    INSERT INTO public.favorite_activity_events (user_id, content_type, content_id, action)
    VALUES (current_user_id, p_content_type, p_content_id, 'opened');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_favorite_opened(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_favorite_opened(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_favorite_content_stats()
RETURNS TABLE (
  content_type text,
  content_id uuid,
  title text,
  saved_count bigint,
  total_opens bigint,
  last_opened_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    f.content_type,
    f.content_id,
    CASE
      WHEN f.content_type = 'recipe' THEN (SELECT r.title FROM public.recipes r WHERE r.id = f.content_id)
      WHEN f.content_type IN ('video', 'guide') THEN (SELECT r.title FROM public.resources r WHERE r.id = f.content_id)
      WHEN f.content_type = 'exercise' THEN (SELECT m.title FROM public.movement_items m WHERE m.id = f.content_id)
    END AS title,
    count(*)::bigint AS saved_count,
    sum(f.open_count)::bigint AS total_opens,
    max(f.last_opened_at) AS last_opened_at
  FROM public.user_favorites f
  GROUP BY f.content_type, f.content_id
  ORDER BY count(*) DESC, sum(f.open_count) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_favorite_content_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_favorite_content_stats() TO authenticated;
