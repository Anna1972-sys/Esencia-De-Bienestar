import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
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
import { mediaUrl } from "@/lib/mediaStorage";
import { ArrowLeft, BookOpen, ChevronRight, FileText, Image as ImageIcon, Search, Video, X } from "lucide-react";

type NutritionCategory = {
  id?: string;
  key: string;
  label: string;
  emoji?: string | null;
  image_url?: string | null;
  image?: string;
  subtitle?: string | null;
  visible?: boolean | null;
  sort_order?: number | null;
};

type NutritionItem = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  category_id?: string | null;
  cover_image?: string | null;
  cover_image_url?: string | null;
  image_url?: string | null;
  blocks?: any;
  tags?: string[] | null;
  visible?: boolean | null;
  created_at?: string | null;
};

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

function normalizeKey(value?: string | null) {
  return (value ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function firstBlockByType(blocks: any, types: string[]) {
  if (!Array.isArray(blocks)) return null;
  return blocks.find((block) => block?.type && types.includes(block.type) && (block.url || block.value || block.label)) ?? null;
}

function firstMediaFromBlocks(blocks: any) {
  return firstBlockByType(blocks, ["image", "video"])?.url ?? null;
}

function firstTextFromBlocks(blocks: any) {
  return firstBlockByType(blocks, ["text"])?.value ?? "";
}

function shortText(value?: string | null, max = 130) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function contentType(item: NutritionItem) {
  const blocks = Array.isArray(item.blocks) ? item.blocks : [];
  if (blocks.some((block) => block?.type === "pdf" && block.url)) return { label: "PDF", icon: <FileText className="h-3.5 w-3.5" /> };
  if (blocks.some((block) => block?.type === "video" && block.url)) return { label: "Vídeo", icon: <Video className="h-3.5 w-3.5" /> };
  if (item.cover_image || item.cover_image_url || item.image_url || blocks.some((block) => block?.type === "image" && block.url)) {
    return { label: "Imagen", icon: <ImageIcon className="h-3.5 w-3.5" /> };
  }
  return { label: "Texto", icon: <FileText className="h-3.5 w-3.5" /> };
}

function itemMatchesCategory(item: NutritionItem, category: NutritionCategory) {
  const itemCategoryId = item.category_id ? String(item.category_id) : "";
  const itemCategory = normalizeKey(item.category);
  const candidates = [
    category.id,
    category.key,
    category.label,
    normalizeKey(category.key),
    normalizeKey(category.label),
  ].filter(Boolean).map(String);

  return candidates.some((candidate) => (
    itemCategoryId === candidate ||
    item.category === candidate ||
    itemCategory === normalizeKey(candidate)
  ));
}

function itemSearchText(item: NutritionItem) {
  const blocksText = Array.isArray(item.blocks)
    ? item.blocks.map((block) => block?.value || block?.label || block?.caption || "").join(" ")
    : "";
  return [item.title, item.subtitle, item.description, item.category, blocksText, ...(item.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function Nutrition() {
  const [categories, setCategories] = useState<NutritionCategory[]>([]);
  const [items, setItems] = useState<NutritionItem[]>([]);
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [{ data: categoriesData }, { data: itemsData, error: itemsError }] = await Promise.all([
        (supabase as any).from("nutrition_categories").select("*").order("sort_order", { ascending: true }),
        (supabase as any)
          .from("nutrition_items")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false }),
      ]);

      if (!mounted) return;

      const sourceCategories = categoriesData?.length ? categoriesData : NUTRITION_CATEGORIES;
      const normalizedCategories = sourceCategories
        .filter((category: any) => category.visible !== false)
        .map((category: any) => ({
          ...category,
          image: mediaUrl(category.image_url || category.image || categoryImages[category.key] || categoryImages[normalizeKey(category.label)]),
        }));

      if (itemsError) {
        console.error("[nutrition_items] No se pudieron cargar las publicaciones", itemsError);
      }

      setCategories(normalizedCategories);
      setItems((itemsData ?? []).filter((item: NutritionItem) => item.visible !== false));
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, []);

  const activeCategory = useMemo(
    () => categories.find((category) => category.key === activeCategoryKey) ?? null,
    [categories, activeCategoryKey]
  );

  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const category of categories) {
      next[category.key] = items.filter((item) => itemMatchesCategory(item, category)).length;
    }
    return next;
  }, [categories, items]);

  const term = query.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    if (!activeCategory) return [];
    return items
      .filter((item) => itemMatchesCategory(item, activeCategory))
      .filter((item) => !term || itemSearchText(item).includes(term));
  }, [activeCategory, items, term]);

  const openCategory = (category: NutritionCategory) => {
    setActiveCategoryKey(category.key);
    setQuery("");
  };

  if (loading) return <div className="muted">Cargando nutrición deportiva…</div>;

  return (
    <div className="pb-8 wellness-nutrition p-5 -mx-1">
      {activeCategory ? (
        <>
          <button
            onClick={() => setActiveCategoryKey(null)}
            className="text-sm muted inline-flex items-center gap-1 mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Categorías
          </button>

          <h1 className="heading-lg mb-1">{activeCategory.label}</h1>
          <p className="text-sm muted mb-4">
            {visibleItems.length} publicación{visibleItems.length === 1 ? "" : "es"}
          </p>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar dentro de esta categoría…"
              className="field pl-9 pr-9 w-full"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 muted"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {visibleItems.length === 0 ? (
            <div className="card-soft p-6 text-center muted">
              {term ? "No hemos encontrado publicaciones con esa búsqueda." : "Esta categoría todavía no tiene publicaciones visibles."}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleItems.map((item) => {
                const cover = item.cover_image || item.cover_image_url || item.image_url || firstMediaFromBlocks(item.blocks);
                const type = contentType(item);
                const description = shortText(item.subtitle || item.description || firstTextFromBlocks(item.blocks) || "Abre la publicación para consultar todo el contenido.");
                const date = item.created_at ? new Date(item.created_at).toLocaleDateString("es-ES") : "";

                return (
                  <Link
                    key={item.id}
                    to={`/app/nutricion/${item.id}`}
                    className="card-soft overflow-hidden block hover:shadow-glow transition"
                  >
                    {cover ? (
                      <img src={mediaUrl(cover)} alt="" className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-[#FFF7FA] to-[#F7D8EA] grid place-items-center text-primary text-sm font-medium">
                        Contenido de nutrición
                      </div>
                    )}
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium leading-tight">{item.title || "Publicación sin título"}</div>
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] text-foreground border border-primary/25">
                          {type.icon}
                          {type.label}
                        </div>
                        {description && <p className="text-sm muted mt-2 line-clamp-2">{description}</p>}
                        {date && <div className="text-[11px] muted mt-2">{date}</div>}
                        <span className="btn-secondary mt-3 inline-flex text-xs px-3 py-1.5">Ver contenido</span>
                      </div>
                      <ChevronRight className="h-4 w-4 muted shrink-0 mt-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="h-4 w-4" /> Volver
          </BackButton>

          <div className="nutrition-hero rounded-[28px] p-5 mb-5 flex items-center justify-between overflow-hidden relative">
            <img src={nutritionHeroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/25" />
            <div className="relative z-10">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#FF8BC7]">Rendimiento consciente</p>
              <p className="text-white font-bold text-lg mt-1 drop-shadow">Nutrición para sentirte bien</p>
              <p className="text-white/85 text-xs mt-1 drop-shadow">Proteína, energía y recuperación.</p>
            </div>
          </div>

          <h1 className="heading-lg mb-1">Nutrición deportiva</h1>
          <p className="text-sm muted mb-4">Rendimiento, hidratación y energía. Explora por categoría.</p>

          <div className="grid grid-cols-2 gap-3">
            {categories.map((category) => (
              <button
                key={category.id || category.key}
                onClick={() => openCategory(category)}
                className="nutrition-category-card text-left hover:shadow-glow transition"
              >
                {category.image ? (
                  <div className="nutrition-category-image mb-3 overflow-hidden rounded-2xl">
                    <img src={category.image} alt="" loading="lazy" className="h-28 w-full object-cover" />
                  </div>
                ) : (
                  <div className="text-2xl mb-1">{category.emoji}</div>
                )}
                <div className="font-medium text-sm">{category.label}</div>
                {category.subtitle && <div className="text-xs mt-1 nutrition-category-subtitle">{category.subtitle}</div>}
                <div className="text-xs muted mt-1 inline-flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> {counts[category.key] ?? 0}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
