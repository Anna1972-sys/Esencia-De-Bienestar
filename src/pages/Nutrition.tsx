import { useEffect, useState } from "react";
import LibraryPage from "@/components/library/LibraryPage";
import { supabase } from "@/integrations/supabase/client";
import { NUTRITION_CATEGORIES } from "@/lib/nutritionCategories";
import hidratacionImage from "@/assets/nutrition/hidratacion.png";
import proteinasImage from "@/assets/nutrition/proteinas.png";
import recuperacionImage from "@/assets/nutrition/recuperacion-realimentacion.png";
import postEntrenoImage from "@/assets/nutrition/post-entreno.png";
import suplementacionImage from "@/assets/nutrition/suplementacion.png";
import alimentacionImage from "@/assets/nutrition/alimentacion-deportiva.png";
import planesImage from "@/assets/nutrition/planes-guias.png";
import nutritionHeroImage from "@/assets/nutrition/home-tortitas-h24.png";

const categoryImages: Record<string, string> = {
  nutricion: proteinasImage,
  hidratacion: hidratacionImage,
  proteinas: proteinasImage,
  "pre-entreno": recuperacionImage,
  preentrenamiento: recuperacionImage,
  entrenamiento: alimentacionImage,
  "post-entreno": postEntrenoImage,
  "recuperacion-postentrenamiento": postEntrenoImage,
  "ganancia-masa-muscular": proteinasImage,
  "perdida-grasa": alimentacionImage,
  resistencia: recuperacionImage,
  suplementacion: suplementacionImage,
  "suplementacion-deportiva": suplementacionImage,
  recetas: alimentacionImage,
  "recetas-deportivas": alimentacionImage,
  planes: planesImage,
  "guias-videos": planesImage,
  protocolos: planesImage,
};

export default function Nutrition() {
  const [categories, setCategories] = useState<{ key: string; label: string; emoji?: string | null; image?: string; subtitle?: string | null; visible?: boolean | null }[]>([]);

  useEffect(() => {
    (supabase as any)
      .from("nutrition_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }: any) => {
        const source = data?.length ? data : NUTRITION_CATEGORIES;
        setCategories(source
          .filter((category: any) => category.visible !== false)
          .map((category: any) => ({
            ...category,
            image: category.image_url || categoryImages[category.key],
          })));
      });
  }, []);

  return (
    <LibraryPage
      table="nutrition_items"
      basePath="/app/nutricion"
      title="Nutrición deportiva"
      subtitle="Rendimiento, hidratación y energía. Explora por categoría."
      categories={categories}
      variant="nutrition"
      visibleOnly
      hero={
        <div className="nutrition-hero rounded-[28px] p-5 mb-5 flex items-center justify-between overflow-hidden relative">
          <img src={nutritionHeroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/25" />
          <div className="relative z-10">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#FF8BC7]">Rendimiento consciente</p>
            <p className="text-white font-bold text-lg mt-1 drop-shadow">Nutrición para sentirte bien</p>
            <p className="text-white/85 text-xs mt-1 drop-shadow">Proteína, energía y recuperación.</p>
          </div>
        </div>
      }
    />
  );
}
