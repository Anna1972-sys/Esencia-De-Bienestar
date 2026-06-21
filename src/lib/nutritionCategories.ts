export const NUTRITION_CATEGORIES = [
  { key: "hidratacion", label: "Hidratación", emoji: "💧" },
  { key: "proteinas", label: "Proteínas", emoji: "🥚" },
  { key: "pre-entreno", label: "Pre-entreno", emoji: "⚡" },
  { key: "post-entreno", label: "Post-entreno", emoji: "🌿" },
  { key: "suplementacion", label: "Suplementación", emoji: "💊" },
  { key: "recetas", label: "Recetas deportivas", emoji: "🍓" },
  { key: "planes", label: "Planes y guías", emoji: "📅" },
] as const;

export type NutritionCategoryKey = (typeof NUTRITION_CATEGORIES)[number]["key"];

export const getNutritionCategory = (key?: string | null) =>
  NUTRITION_CATEGORIES.find((c) => c.key === key) ?? null;
