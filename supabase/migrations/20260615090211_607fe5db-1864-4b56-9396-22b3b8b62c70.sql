
CREATE TABLE public.wellness_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric text NOT NULL,
  value numeric(7,2) NOT NULL,
  unit text NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_measurements TO authenticated;
GRANT ALL ON public.wellness_measurements TO service_role;
ALTER TABLE public.wellness_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own measurements" ON public.wellness_measurements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX wellness_measurements_user_metric_idx ON public.wellness_measurements(user_id, metric, measured_at);
CREATE TRIGGER trg_wellness_measurements_updated_at BEFORE UPDATE ON public.wellness_measurements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.wellness_progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('before','after')),
  image_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, metric, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_progress_photos TO authenticated;
GRANT ALL ON public.wellness_progress_photos TO service_role;
ALTER TABLE public.wellness_progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own progress photos" ON public.wellness_progress_photos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_wellness_progress_photos_updated_at BEFORE UPDATE ON public.wellness_progress_photos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
