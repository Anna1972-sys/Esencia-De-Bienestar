CREATE POLICY "Authenticated can read admin shopping items"
ON public.shopping_list_items
FOR SELECT
TO authenticated
USING (public.has_role(user_id, 'admin'::app_role));