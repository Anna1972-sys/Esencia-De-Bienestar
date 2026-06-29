import { useEffect, useState } from "react";
import LibraryDetailPage from "@/components/library/LibraryDetailPage";
import { supabase } from "@/integrations/supabase/client";
import { NUTRITION_CATEGORIES } from "@/lib/nutritionCategories";

export default function NutritionDetail() {
  const [categories, setCategories] = useState<any[]>([...NUTRITION_CATEGORIES]);

  useEffect(() => {
    (supabase as any)
      .from("nutrition_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }: any) => {
        if (data?.length) setCategories(data.filter((category: any) => category.visible !== false));
      });
  }, []);

  return (
    <LibraryDetailPage
      table="nutrition_items"
      basePath="/app/nutricion"
      categories={categories}
      visibleOnly
    />
  );
}
