export const MOVEMENT_CATEGORIES = [
  { key: "casa", label: "Ejercicio en casa", emoji: "🏡" },
  { key: "caminar", label: "Caminar y pasos", emoji: "🚶" },
  { key: "fuerza", label: "Fuerza y tonificación", emoji: "💪" },
  { key: "movilidad", label: "Movilidad y estiramientos", emoji: "🧘" },
  { key: "cardio", label: "Cardio y salud cardiovascular", emoji: "❤️" },
  { key: "videos", label: "Vídeos de entrenamiento", emoji: "🎥" },
  { key: "rutinas", label: "Rutinas semanales", emoji: "📅" },
] as const;

export type MovementCategoryKey = (typeof MOVEMENT_CATEGORIES)[number]["key"];

export const getMovementCategory = (key?: string | null) =>
  MOVEMENT_CATEGORIES.find((c) => c.key === key) ?? null;

export type MovementBlock =
  | { type: "title"; value: string }
  | { type: "subtitle"; value: string }
  | { type: "text"; value: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "video"; url: string; caption?: string }
  | { type: "pdf"; url: string; name?: string }
  | { type: "link"; label: string; url: string }
  | { type: "button"; label: string; url: string };

// Shared content block type (used by Movimiento y ejercicio and Nutrición deportiva)
export type ContentBlock = MovementBlock;

