
CREATE TABLE public.movement_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  cover_image TEXT,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movement_items TO authenticated;
GRANT ALL ON public.movement_items TO service_role;

ALTER TABLE public.movement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view movement items"
ON public.movement_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert movement items"
ON public.movement_items FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update movement items"
ON public.movement_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete movement items"
ON public.movement_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_movement_items_updated_at
BEFORE UPDATE ON public.movement_items
FOR EACH ROW EXECUTE FUNCTION public.update_wellness_entries_updated_at();
