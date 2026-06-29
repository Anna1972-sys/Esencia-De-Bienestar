ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS recipe_generator_categories jsonb NOT NULL DEFAULT
'[
  {
    "id": "comidas_saludables",
    "label": "Comidas saludables",
    "description": "450–500 kcal, alta en proteína y con verduras."
  },
  {
    "id": "almuerzos",
    "label": "Almuerzos",
    "description": "Máximo 180 kcal, práctico y transportable."
  },
  {
    "id": "meriendas",
    "label": "Meriendas",
    "description": "Máximo 180 kcal, fácil y alta en proteína."
  },
  {
    "id": "nutricion_deportiva",
    "label": "Nutrición deportiva",
    "description": "Masa muscular, proteína y cantidades coherentes."
  }
]'::jsonb;
