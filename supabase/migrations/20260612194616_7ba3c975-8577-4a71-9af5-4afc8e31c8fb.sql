
CREATE POLICY "challenge_media_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'challenge-media' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'challenge-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "challenge_media_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'challenge-media');
