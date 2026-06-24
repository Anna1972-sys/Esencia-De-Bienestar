ALTER TABLE public.wellness_measurements REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'wellness_measurements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wellness_measurements;
  END IF;
END $$;
