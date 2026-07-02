ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_items TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'food_items'
      AND policyname = 'food_items_admin_read_all'
  ) THEN
    CREATE POLICY "food_items_admin_read_all"
      ON public.food_items
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'food_items'
      AND policyname = 'food_items_admin_insert_manual'
  ) THEN
    CREATE POLICY "food_items_admin_insert_manual"
      ON public.food_items
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        AND source_type = 'manual'
        AND verificado = true
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'food_items'
      AND policyname = 'food_items_admin_update_manual'
  ) THEN
    CREATE POLICY "food_items_admin_update_manual"
      ON public.food_items
      FOR UPDATE
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        AND source_type = 'manual'
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        AND source_type = 'manual'
        AND verificado = true
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'food_items'
      AND policyname = 'food_items_admin_delete_manual'
  ) THEN
    CREATE POLICY "food_items_admin_delete_manual"
      ON public.food_items
      FOR DELETE
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        AND source_type = 'manual'
      );
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
