export const RESOURCE_CATEGORIES = [
  { key: "imprescindibles", label: "Imprescindibles", emoji: "⭐" },
  { key: "educacion", label: "Educación nutricional", emoji: "📚" },
  { key: "alimentacion", label: "Alimentación saludable", emoji: "🥗" },
  { key: "perdida-peso", label: "Pérdida de peso", emoji: "⚖️" },
  { key: "mentalidad", label: "Mentalidad y hábitos", emoji: "🧠" },
  { key: "videos", label: "Vídeos", emoji: "🎥" },
  { key: "guias", label: "Guías y recursos", emoji: "📄" },
] as const;

export type ResourceCategoryKey = (typeof RESOURCE_CATEGORIES)[number]["key"];

export const getResourceCategory = (key?: string | null) =>
  RESOURCE_CATEGORIES.find((c) => c.key === key) ?? null;

export type ResourceBlock =
  | { type: "text"; value: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "video"; url: string; caption?: string }
  | { type: "pdf"; url: string; name?: string };
