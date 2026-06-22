import LibraryPage from "@/components/library/LibraryPage";
import { MOVEMENT_CATEGORIES } from "@/lib/movementCategories";

export default function Movement() {
  return (
    <LibraryPage
      table="movement_items"
      basePath="/app/movimiento"
      title="Movimiento y ejercicio"
      subtitle="Actívate cada día. Explora por categoría."
      categories={MOVEMENT_CATEGORIES}
    />
  );
}
