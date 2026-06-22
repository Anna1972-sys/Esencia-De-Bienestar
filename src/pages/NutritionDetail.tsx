import LibraryDetailPage from "@/components/library/LibraryDetailPage";
import { NUTRITION_CATEGORIES } from "@/lib/nutritionCategories";

export default function NutritionDetail() {
  return (
    <LibraryDetailPage
      table="nutrition_items"
      basePath="/app/nutricion"
      categories={NUTRITION_CATEGORIES}
    />
  );
}
