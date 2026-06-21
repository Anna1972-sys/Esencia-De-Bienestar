
CREATE POLICY "Users read own progress photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own progress photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own progress photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own progress photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
