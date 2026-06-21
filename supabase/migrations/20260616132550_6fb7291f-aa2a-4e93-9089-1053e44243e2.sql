-- Remove the contradictory restrictive policy. It does not protect anything that
-- recipes_library_read isn't already scoping, and it conflicts with intended
-- library visibility. Private user recipes (is_library=false, visibility NOT IN
-- ('community','featured')) remain protected because recipes_library_read does
-- not match them, so only the owner (recipes_own) and admins (recipes_admin_all)
-- can read them.
DROP POLICY IF EXISTS recipes_non_admin_visibility_lock ON public.recipes;

-- Replace recipes_library_read with an explicit policy that hides the owner's
-- user_id concern by being precise about what is shared. Library, community and
-- featured recipes are intended to be shared with all authenticated users.
DROP POLICY IF EXISTS recipes_library_read ON public.recipes;
CREATE POLICY recipes_shared_read
  ON public.recipes
  FOR SELECT
  TO authenticated
  USING (
    is_library = true
    OR visibility IN ('community', 'featured')
  );