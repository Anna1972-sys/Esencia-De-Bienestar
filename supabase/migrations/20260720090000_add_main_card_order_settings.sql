ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS home_card_order jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS admin_card_order jsonb NOT NULL DEFAULT '[]'::jsonb;
