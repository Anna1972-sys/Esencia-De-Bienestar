import LibraryPage from "@/components/library/LibraryPage";
import { MOVEMENT_CATEGORIES } from "@/lib/movementCategories";
import casaImage from "@/assets/movement/ejercicio-casa.png";
import caminarImage from "@/assets/movement/caminar-pasos.png";
import fuerzaImage from "@/assets/movement/fuerza-tonificacion.png";
import movilidadImage from "@/assets/movement/movilidad-estiramientos.png";
import cardioImage from "@/assets/movement/cardio-salud.png";
import videosImage from "@/assets/movement/videos-entrenamiento.png";
import rutinasImage from "@/assets/movement/rutinas-semanales.png";

const movementImages: Record<string, string> = {
  casa: casaImage,
  caminar: caminarImage,
  fuerza: fuerzaImage,
  movilidad: movilidadImage,
  cardio: cardioImage,
  videos: videosImage,
  rutinas: rutinasImage,
};

export default function Movement() {
  return (
    <LibraryPage
      table="movement_items"
      basePath="/app/movimiento"
      title="Movimiento y ejercicio"
      subtitle="Actívate cada día. Explora por categoría."
      categories={MOVEMENT_CATEGORIES.map((category) => ({ ...category, image: movementImages[category.key] }))}
      variant="movement"
    />
  );
}
