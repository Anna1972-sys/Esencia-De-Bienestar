alter table public.resource_categories
  add column if not exists subtitle text,
  add column if not exists cover_image text;
