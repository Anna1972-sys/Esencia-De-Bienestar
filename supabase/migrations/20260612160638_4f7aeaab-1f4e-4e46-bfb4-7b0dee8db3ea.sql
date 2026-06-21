CREATE TABLE public.wellness_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric(5,2),
  waist_cm numeric(5,2),
  hip_cm numeric(5,2),
  chest_cm numeric(5,2),
  arm_cm numeric(5,2),
  thigh_cm numeric(5,2),
  water_ml integer,
  sleep_hours numeric(4,2),
  mood smallint,
  exercise text,
  steps integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_entries TO authenticated;
GRANT ALL ON public.wellness_entries TO service_role;

ALTER TABLE public.wellness_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wellness entries"
  ON public.wellness_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_wellness_entries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_wellness_entries_updated_at
  BEFORE UPDATE ON public.wellness_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_wellness_entries_updated_at();

CREATE TABLE public.wellness_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric text NOT NULL,
  target_value numeric(7,2) NOT NULL,
  start_value numeric(7,2),
  achieved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_goals TO authenticated;
GRANT ALL ON public.wellness_goals TO service_role;

ALTER TABLE public.wellness_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wellness goals"
  ON public.wellness_goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_wellness_goals_updated_at
  BEFORE UPDATE ON public.wellness_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_wellness_entries_updated_at();