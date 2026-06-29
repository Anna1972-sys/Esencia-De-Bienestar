import LibraryAdminPage from "@/components/library/LibraryAdminPage";
import { MOVEMENT_CATEGORIES } from "@/lib/movementCategories";

export default function AdminMovement() {
  return (
    <LibraryAdminPage
      table="movement_items"
      storageFolder="movement"
      backTo="/app/admin"
      title="Movimiento y ejercicio"
      categories={MOVEMENT_CATEGORIES}
      className="admin-movement-page"
    />
  );
}
