CREATE POLICY "Admins manage resource-media" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'resource-media' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'resource-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read resource-media" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resource-media');