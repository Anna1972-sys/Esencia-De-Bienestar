import { useEffect, useState } from "react";
import LibraryPage from "@/components/library/LibraryPage";
import { supabase } from "@/integrations/supabase/client";

export default function Nutrition() {
  const [categories, setCategories] = useState<{ key: string; label: string; emoji: string }[]>([]);

  useEffect(() => {
    (supabase as any)
      .from("nutrition_categories")
      .select("key, label, emoji")
      .order("sort_order", { ascending: true })
      .then(({ data }: any) => setCategories(data ?? []));
  }, []);

  return (
    <LibraryPage
      table="nutrition_items"
      basePath="/app/nutricion"
      title="Nutrición deportiva"
      subtitle="Rendimiento, hidratación y energía. Explora por categoría."
      categories={categories}
    />
  );
}
