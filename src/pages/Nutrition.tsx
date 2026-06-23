import { useEffect, useState } from "react";
import LibraryPage from "@/components/library/LibraryPage";
import { supabase } from "@/integrations/supabase/client";
import { Apple, Dumbbell, GlassWater } from "lucide-react";

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
      variant="nutrition"
      hero={
        <div className="nutrition-hero rounded-[28px] p-5 mb-5 flex items-center justify-between overflow-hidden relative">
          <div className="relative">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#9DFF00]">Rendimiento consciente</p>
            <p className="text-white font-bold text-lg mt-1">Nutrición para sentirte bien</p>
            <p className="text-white/65 text-xs mt-1">Proteína, energía y recuperación.</p>
          </div>
          <div className="flex items-end gap-2 text-primary relative" aria-hidden>
            <Dumbbell className="h-7 w-7 text-black fill-black" />
            <GlassWater className="h-10 w-10" />
            <Apple className="h-7 w-7 text-[#9DFF00]" />
          </div>
        </div>
      }
    />
  );
}
