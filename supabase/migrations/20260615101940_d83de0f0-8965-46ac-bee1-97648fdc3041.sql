
-- Admin read-only access to clients' wellness data
CREATE POLICY "Admins can view all wellness entries"
  ON public.wellness_entries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all wellness goals"
  ON public.wellness_goals FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all wellness measurements"
  ON public.wellness_measurements FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all wellness progress photos"
  ON public.wellness_progress_photos FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin read access to progress-photos storage bucket
CREATE POLICY "Admins can read progress photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'progress-photos' AND public.has_role(auth.uid(), 'admin'));
