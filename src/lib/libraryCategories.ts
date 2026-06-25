import desayunoHerbalife from "@/assets/cat-desayuno-herbalife-premium.png";
import desayunoSin from "@/assets/cat-desayuno-sin-premium.png";
import snacks from "@/assets/cat-snacks-premium.png";
import comidas from "@/assets/cat-comidas.jpg";
import meriendas from "@/assets/cat-meriendas-premium.png";
import cenaHerbalife from "@/assets/cat-cena-herbalife.jpg";
import cenaSin from "@/assets/cat-cena-sin.jpg";

export const LIBRARY_CATEGORIES: { id: string; label: string; image?: string }[] = [
  { id: "desayunos_herbalife", label: "Desayunos con Herbalife", image: desayunoHerbalife },
  { id: "desayunos_sin_herbalife", label: "Desayunos sin Herbalife", image: desayunoSin },
  { id: "snacks", label: "Snacks saludables", image: snacks },
  { id: "comidas", label: "Comidas", image: comidas },
  { id: "meriendas", label: "Meriendas", image: meriendas },
  { id: "cenas_herbalife", label: "Cenas con Herbalife", image: cenaHerbalife },
  { id: "cenas_sin_herbalife", label: "Cenas sin Herbalife", image: cenaSin },
] as const;

export type LibraryCategoryId = typeof LIBRARY_CATEGORIES[number]["id"];

export const getCategoryLabel = (id?: string | null) =>
  LIBRARY_CATEGORIES.find(c => c.id === id)?.label ?? "Sin categoría";

export const getCategoryImage = (id?: string | null) =>
  LIBRARY_CATEGORIES.find(c => c.id === id)?.image;
