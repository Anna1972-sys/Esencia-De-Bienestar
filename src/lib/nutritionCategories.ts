export const NUTRITION_CATEGORIES = [
  { key: "proteinas", label: "Nutrición", emoji: "🥚", subtitle: "Bases para cuidar tu rendimiento." },
  { key: "pre-entreno", label: "Preentrenamiento", emoji: "⚡", subtitle: "Energía antes de entrenar." },
  { key: "entrenamiento", label: "Entrenamiento", emoji: "🏋️", subtitle: "Apoyo durante la sesión." },
  { key: "post-entreno", label: "Recuperación postentrenamiento", emoji: "🌿", subtitle: "Recupera mejor después del esfuerzo." },
  { key: "ganancia-masa-muscular", label: "Ganancia de masa muscular", emoji: "💪", subtitle: "Proteína, fuerza y progreso." },
  { key: "perdida-grasa", label: "Pérdida de grasa", emoji: "🔥", subtitle: "Define con equilibrio." },
  { key: "resistencia", label: "Resistencia", emoji: "🏃", subtitle: "Energía sostenida y fondo físico." },
  { key: "hidratacion", label: "Hidratación", emoji: "💧", subtitle: "Agua, sales y equilibrio diario." },
  { key: "suplementacion", label: "Suplementación deportiva", emoji: "💊", subtitle: "Productos y guías de uso." },
  { key: "recetas", label: "Recetas deportivas", emoji: "🍓", subtitle: "Ideas prácticas para entrenar mejor." },
  { key: "planes", label: "Guías y vídeos", emoji: "🎥", subtitle: "Aprende con recursos visuales." },
  { key: "protocolos", label: "Protocolos", emoji: "📋", subtitle: "Pautas para objetivos concretos." },
] as const;

export type NutritionCategoryKey = (typeof NUTRITION_CATEGORIES)[number]["key"];

export const getNutritionCategory = (key?: string | null) =>
  NUTRITION_CATEGORIES.find((c) => c.key === key) ?? null;
