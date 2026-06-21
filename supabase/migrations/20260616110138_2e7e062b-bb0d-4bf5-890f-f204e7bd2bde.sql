
-- Lock down user_roles writes with an explicit RESTRICTIVE policy so only admins
-- can INSERT/UPDATE/DELETE rows, preventing self-assignment of admin.
CREATE POLICY "user_roles_writes_admin_only"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Prevent non-admin users from marking their own recipes as library/community/featured,
-- which would otherwise expose them via recipes_library_read.
CREATE POLICY "recipes_non_admin_visibility_lock"
ON public.recipes
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    COALESCE(is_library, false) = false
    AND (visibility IS NULL OR visibility NOT IN ('community', 'featured'))
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    COALESCE(is_library, false) = false
    AND (visibility IS NULL OR visibility NOT IN ('community', 'featured'))
  )
);
