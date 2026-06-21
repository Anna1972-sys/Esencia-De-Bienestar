
-- Fix 1: Prevent non-admin users from promoting their own recipes to library or community/featured visibility
DROP POLICY IF EXISTS recipes_own ON public.recipes;
CREATE POLICY recipes_own ON public.recipes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (
        COALESCE(is_library, false) = false
        AND (visibility IS NULL OR visibility NOT IN ('community','featured'))
      )
    )
  );

-- Fix 2: Remove redundant overlapping permissive admin policy on user_roles
DROP POLICY IF EXISTS roles_admin_all ON public.user_roles;
