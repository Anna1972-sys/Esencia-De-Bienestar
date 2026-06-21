CREATE POLICY "mealplans_admin_read" ON public.meal_plans
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));