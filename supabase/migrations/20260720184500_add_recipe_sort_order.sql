alter table public.recipes
  add column if not exists sort_order integer not null default 0;

create index if not exists idx_recipes_category_sort_order
  on public.recipes (category, sort_order);
