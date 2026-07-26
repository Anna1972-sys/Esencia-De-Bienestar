BEGIN;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS home_card_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_card_order jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO public.app_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

COMMIT;
