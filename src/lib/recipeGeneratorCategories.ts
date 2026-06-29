import type { SupabaseClient } from "@supabase/supabase-js";

export type RecipeGeneratorCategory = {
  id: string;
  label: string;
  description: string;
};

export const DEFAULT_RECIPE_GENERATOR_CATEGORIES: RecipeGeneratorCategory[] = [
  { id: "comidas_saludables", label: "Comidas saludables", description: "450–500 kcal, alta en proteína y con verduras." },
  { id: "almuerzos", label: "Almuerzos", description: "Máximo 180 kcal, práctico y transportable." },
  { id: "meriendas", label: "Meriendas", description: "Máximo 180 kcal, fácil y alta en proteína." },
  { id: "nutricion_deportiva", label: "Nutrición deportiva", description: "Masa muscular, proteína y cantidades coherentes." },
];

const STORAGE_KEY = "esencia.recipeGeneratorCategories";

export function slugifyRecipeCategory(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function normalizeRecipeGeneratorCategories(categories: RecipeGeneratorCategory[]) {
  const seen = new Set<string>();
  return categories
    .map((item, index) => {
      const label = item.label.trim();
      const idBase = item.id.trim() || slugifyRecipeCategory(label) || `tipo_${index + 1}`;
      let id = slugifyRecipeCategory(idBase) || `tipo_${index + 1}`;
      let suffix = 2;
      while (seen.has(id)) {
        id = `${slugifyRecipeCategory(idBase)}_${suffix}`;
        suffix += 1;
      }
      seen.add(id);
      return {
        id,
        label,
        description: item.description.trim(),
      };
    })
    .filter(item => item.label);
}

function readLocalCategories() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const normalized = normalizeRecipeGeneratorCategories(parsed);
    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
}

function writeLocalCategories(categories: RecipeGeneratorCategory[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

export async function loadRecipeGeneratorCategories(supabase?: SupabaseClient) {
  if (supabase) {
    try {
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .select("recipe_generator_categories")
        .eq("id", true)
        .maybeSingle();

      if (!error && Array.isArray(data?.recipe_generator_categories)) {
        const normalized = normalizeRecipeGeneratorCategories(data.recipe_generator_categories);
        if (normalized.length) {
          writeLocalCategories(normalized);
          return normalized;
        }
      }
    } catch {
      // Si la columna aún no existe en Supabase, usamos el respaldo local/por defecto.
    }
  }

  return readLocalCategories() ?? DEFAULT_RECIPE_GENERATOR_CATEGORIES;
}

export async function saveRecipeGeneratorCategories(categories: RecipeGeneratorCategory[], supabase?: SupabaseClient) {
  const normalized = normalizeRecipeGeneratorCategories(categories);
  const safeCategories = normalized.length ? normalized : DEFAULT_RECIPE_GENERATOR_CATEGORIES;
  writeLocalCategories(safeCategories);

  if (!supabase) return { categories: safeCategories, savedRemotely: false };

  try {
    const { error } = await (supabase as any)
      .from("app_settings")
      .update({
        recipe_generator_categories: safeCategories,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);

    return { categories: safeCategories, savedRemotely: !error, error };
  } catch (error) {
    return { categories: safeCategories, savedRemotely: false, error };
  }
}
