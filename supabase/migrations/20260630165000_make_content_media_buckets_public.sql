-- Ensure app content media buckets exist and are publicly readable so tables can
-- store stable storage paths instead of expiring signed URLs.
-- Private user progress photos remain private.

CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
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
      AND role = 'admin'::public.app_role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('recipe-images', 'recipe-images', true),
  ('resource-media', 'resource-media', true),
  ('challenge-media', 'challenge-media', true),
  ('product-media', 'product-media', true),
  ('nutrition-media', 'nutrition-media', true),
  ('progress-photos', 'progress-photos', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Content media public read" ON storage.objects;
DROP POLICY IF EXISTS "Admins insert content media" ON storage.objects;
DROP POLICY IF EXISTS "Admins update content media" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete content media" ON storage.objects;

CREATE POLICY "Content media public read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id IN (
      'recipe-images',
      'resource-media',
      'challenge-media',
      'product-media',
      'nutrition-media'
    )
  );

CREATE POLICY "Admins insert content media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN (
      'recipe-images',
      'resource-media',
      'challenge-media',
      'product-media',
      'nutrition-media'
    )
    AND public.is_admin_user(auth.uid())
  );

CREATE POLICY "Admins update content media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN (
      'recipe-images',
      'resource-media',
      'challenge-media',
      'product-media',
      'nutrition-media'
    )
    AND public.is_admin_user(auth.uid())
  )
  WITH CHECK (
    bucket_id IN (
      'recipe-images',
      'resource-media',
      'challenge-media',
      'product-media',
      'nutrition-media'
    )
    AND public.is_admin_user(auth.uid())
  );

CREATE POLICY "Admins delete content media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id IN (
      'recipe-images',
      'resource-media',
      'challenge-media',
      'product-media',
      'nutrition-media'
    )
    AND public.is_admin_user(auth.uid())
  );
