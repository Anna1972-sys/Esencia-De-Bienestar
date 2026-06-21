
CREATE POLICY "Recipe images viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipe-images');

CREATE POLICY "Admins can upload recipe images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recipe-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update recipe images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'recipe-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete recipe images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'recipe-images' AND public.has_role(auth.uid(), 'admin'));
