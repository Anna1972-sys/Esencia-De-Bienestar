import LibraryDetailPage from "@/components/library/LibraryDetailPage";
import { MOVEMENT_CATEGORIES } from "@/lib/movementCategories";

export default function MovementDetail() {
  return (
    <LibraryDetailPage
      table="movement_items"
      basePath="/app/movimiento"
      categories={MOVEMENT_CATEGORIES}
    />
  );
}
