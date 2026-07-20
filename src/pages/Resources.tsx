import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronRight, Pin, Search } from "lucide-react";
import imgImprescindibles from "@/assets/resource-imprescindibles.png";
import imgEducacion from "@/assets/resource-educacion.png";
import imgAlimentacion from "@/assets/resource-alimentacion.png";
import imgPerdidaPeso from "@/assets/resource-perdida-peso.png";
import imgMentalidad from "@/assets/resource-mentalidad.png";
import imgVideos from "@/assets/resource-videos.png";
import imgGuias from "@/assets/resource-guias.png";
import GuideCardsGrid, { isGuidesCategory } from "@/components/resources/GuideCardsGrid";

type Category = {
  id: string;
  name: string;
  slug: string | null;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
};

const CATEGORY_CARDS = {
  imprescindibles: { image: imgImprescindibles, subtitle: "Empieza por aquí." },
  educacion: { image: imgEducacion, subtitle: "Aprende a elegir mejor." },
  alimentacion: { image: imgAlimentacion, subtitle: "Ideas para cada día." },
  "perdida-peso": { image: imgPerdidaPeso, subtitle: "Resultados sostenibles." },
  mentalidad: { image: imgMentalidad, subtitle: "Pequeños cambios, grandes resultados." },
  videos: { image: imgVideos, subtitle: "Aprende en pocos minutos." },
  guias: { image: imgGuias, subtitle: "Herramientas para avanzar." },
} as const;

function getCategoryCard(category: Category) {
  const value = (category.slug || category.name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (value.includes("imprescindible")) return CATEGORY_CARDS.imprescindibles;
  if (value.includes("educacion")) return CATEGORY_CARDS.educacion;
  if (value.includes("alimentacion")) return CATEGORY_CARDS.alimentacion;
  if (value.includes("perdida") || value.includes("peso")) return CATEGORY_CARDS["perdida-peso"];
  if (value.includes("mentalidad") || value.includes("habito")) return CATEGORY_CARDS.mentalidad;
  if (value.includes("video")) return CATEGORY_CARDS.videos;
  return CATEGORY_CARDS.guias;
}

export default function Resources() {
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [activeTop, setActiveTop] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase.from("resource_categories").select("*").order("sort_order").then(({ data }) => setCats((data ?? []) as Category[]));
    supabase.from("resources")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data ?? []).filter((item: any) => item.is_published !== false)));
  }, []);

  const tops = cats.filter(c => !c.parent_id);
  const subsOf = (id: string) => cats.filter(c => c.parent_id === id);

  // Map descendant ids for a top-level cat (itself + its subs)
  const descIds = (id: string) => new Set<string>([id, ...subsOf(id).map(s => s.id)]);

  const normalizeSlug = (value?: string | null) =>
    (value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const itemCategory = (item: any) => {
    if (item.category_id) return cats.find(c => c.id === item.category_id) ?? null;
    const legacy = normalizeSlug(item.category);
    if (!legacy) return null;
    return cats.find(c => normalizeSlug(c.slug) === legacy || normalizeSlug(c.name) === legacy) ?? null;
  };

  const itemCategoryMatches = (item: any, ids: Set<string>) => {
    const cat = itemCategory(item);
    if (cat?.id && ids.has(cat.id)) return true;
    const legacy = normalizeSlug(item.category);
    if (!legacy) return false;
    return cats.some(c => ids.has(c.id) && (normalizeSlug(c.slug) === legacy || normalizeSlug(c.name) === legacy));
  };

  const q = String(query ?? "").trim().toLowerCase();
  const searching = q.length > 0;

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeSub) list = list.filter(i => itemCategoryMatches(i, new Set([activeSub])));
    else if (activeTop) {
      const ids = descIds(activeTop);
      list = list.filter(i => itemCategoryMatches(i, ids));
    }
    if (q) {
      list = list.filter(i => {
        const cat = itemCategory(i);
        const parent = cat?.parent_id ? cats.find(c => c.id === cat.parent_id) : null;
        const haystack = [i.title, i.category, cat?.name, parent?.name].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [items, activeTop, activeSub, q, cats]);

  const currentTop = activeTop ? cats.find(c => c.id === activeTop) : null;
  const currentSub = activeSub ? cats.find(c => c.id === activeSub) : null;
  const currentTopIsGuides = isGuidesCategory(currentTop);
  const inside = !!activeTop || searching;

  return (
    <div className="pb-8">
      {inside ? (
        <>
          <button onClick={() => { if (activeSub) setActiveSub(null); else { setActiveTop(null); setQuery(""); } }} className="text-sm muted inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="h-4 w-4" /> {activeSub ? currentTop?.name : "Categorías"}
          </button>

          <h1 className="heading-lg mb-1">
            {searching && !activeTop ? `Resultados${q ? `: "${query}"` : ""}` : (
              <>
                {currentSub ? `${currentSub.icon ?? ""} ${currentSub.name}` : `${currentTop?.icon ?? ""} ${currentTop?.name}`}
              </>
            )}
          </h1>
          <p className="text-sm muted mb-4">{filteredItems.length} publicación{filteredItems.length === 1 ? "" : "es"}</p>

          {currentTopIsGuides && (
            <div className="relative mb-4">
              <Search className="h-4 w-4 muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="field pl-9"
                placeholder="Buscar por nombre o categoría…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          )}

          {/* Subcategory chips */}
          {currentTop && !currentTopIsGuides && subsOf(currentTop.id).length > 0 && !searching && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
              <button onClick={() => setActiveSub(null)} className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${!activeSub ? "bg-primary text-white" : "bg-muted"}`}>Todo</button>
              {subsOf(currentTop.id).map(s => (
                <button key={s.id} onClick={() => setActiveSub(s.id)} className={`shrink-0 text-xs px-3 py-1.5 rounded-full ${activeSub === s.id ? "bg-primary text-white" : "bg-muted"}`}>
                  {s.icon ?? ""} {s.name}
                </button>
              ))}
            </div>
          )}

          {currentTopIsGuides ? (
            <GuideCardsGrid resources={items} query={query} />
          ) : filteredItems.length === 0 ? (
            <div className="card-soft p-6 text-center muted">No hay publicaciones que coincidan.</div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map(it => {
                const cat = itemCategory(it);
                return (
                  <Link key={it.id} to={`/app/recursos/${it.id}`} className="card-soft overflow-hidden block hover:shadow-glow transition">
                    {it.cover_image && <img src={it.cover_image} alt="" className="app-content-cover-image" />}
                    <div className="p-4 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-1.5">
                          {it.is_pinned && <Pin className="h-3 w-3 text-primary fill-primary shrink-0" />}
                          {it.title}
                        </div>
                        <div className="text-xs muted truncate">{cat?.icon} {cat?.name ?? "Sin categoría"}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 muted shrink-0" />
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
          <h1 className="heading-lg mb-1">Vídeos y guías</h1>
          <p className="text-sm muted mb-4">Explora los recursos por categoría.</p>

          <div className="relative mb-4">
            <Search className="h-4 w-4 muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="field pl-9"
              placeholder="Buscar por nombre o categoría…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            {tops.map(c => {
              const card = getCategoryCard(c);
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveTop(c.id)}
                  className="wellness-tile app-category-card group overflow-hidden rounded-[28px] p-0 text-center transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="app-photo-cover-frame w-full overflow-hidden bg-black">
                    <img src={card.image} alt="" className="app-photo-cover-image transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="flex min-h-[92px] flex-col items-center justify-center px-3 py-3.5">
                    <div className="font-sans text-base font-bold leading-tight text-foreground">{c.name}</div>
                    <p className="mt-1.5 text-[10.5px] tracking-wide text-muted-foreground">{card.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
