import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search, Sparkles, Clock } from "lucide-react";
import { LIBRARY_CATEGORIES, getCategoryLabel, getCategoryImage } from "@/lib/libraryCategories";
import BackButton from "@/components/BackButton";

type Recipe = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  ingredients: any;
  steps: any;
  macros: any;
  image_url: string | null;
  is_featured: boolean | null;
  is_library?: boolean | null;
  user_id?: string | null;
  visibility?: string | null;
};

type LibraryContext = {
  selectedCat: string | null;
  query: string;
  scrollY: number;
};

export default function Library() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnContext = (location.state as { libraryContext?: LibraryContext } | null)?.libraryContext;
  const [items, setItems] = useState<Recipe[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(() => returnContext?.selectedCat ?? null);
  const [q, setQ] = useState(() => returnContext?.query ?? "");

  const normalizeCategory = (category?: string | null) => {
    const value = (category ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    if (!value) return null;
    if (LIBRARY_CATEGORIES.some(c => c.id === value)) return value;
    if (value.includes("snack")) return "snacks";
    if (value.includes("merienda")) return "meriendas";
    if (value.includes("comida") || value.includes("almuerzo")) return "comidas";
    if (value.includes("cena")) return value.includes("herbalife") ? "cenas_herbalife" : "cenas_sin_herbalife";
    if (value.includes("desayuno") || value.includes("batido")) return value.includes("herbalife") ? "desayunos_herbalife" : "desayunos_sin_herbalife";
    return null;
  };

  const isVisibleLibraryRecipe = (recipe: Recipe) =>
    recipe.is_library === true ||
    recipe.visibility === "community" ||
    recipe.visibility === "featured";

  const load = () =>
    supabase
      .from("recipes")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("title")
      .then(({ data }) => setItems(((data as any) ?? []).filter(isVisibleLibraryRecipe)));

  useEffect(() => {
    load();
    const channel = supabase
      .channel("library-recipes")
      .on("postgres_changes", { event: "*", schema: "public", table: "recipes" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);


  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach(r => {
      const category = normalizeCategory(r.category);
      if (category) m[category] = (m[category] ?? 0) + 1;
    });
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    const query = String(q ?? "").trim().toLowerCase();
    let list = items;
    if (selectedCat) list = list.filter(r => normalizeCategory(r.category) === selectedCat);
    if (query) {
      list = list.filter(r => {
        if (String(r.title ?? "").toLowerCase().includes(query)) return true;
        const ing = Array.isArray(r.ingredients) ? r.ingredients : [];
        return ing.some((i: any) => {
          const name = typeof i === "string" ? i : i?.name ?? "";
          return String(name ?? "").toLowerCase().includes(query);
        });
      });
    }
    return list;
  }, [items, selectedCat, q]);

  useEffect(() => {
    if (returnContext?.scrollY == null || items.length === 0) return;
    const frame = requestAnimationFrame(() => window.scrollTo(0, returnContext.scrollY));
    return () => cancelAnimationFrame(frame);
  }, [items.length, returnContext?.scrollY]);

  const openRecipe = (id: string) => {
    navigate(`/app/biblioteca/${id}`, {
      state: {
        libraryContext: {
          selectedCat,
          query: q,
          scrollY: window.scrollY,
        } satisfies LibraryContext,
      },
    });
  };


  return (
    <div className="library-recipes-page pb-28">
      <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>
      <h1 className="heading-lg mb-1">Biblioteca de recetas</h1>
      <p className="muted text-sm mb-4">Recetas oficiales seleccionadas para ti.</p>


      <div className="relative mb-5">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 muted" />
        <input
          className="field pl-9"
          placeholder="Buscar por nombre o ingrediente…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {!selectedCat && !q && (
        <div className="grid grid-cols-2 gap-3">
          {LIBRARY_CATEGORIES.map(({ id, label, image }) => {
            const count = counts[id] ?? 0;
            return (
              <button
                key={id}
                onClick={() => setSelectedCat(id)}
                className="card-soft overflow-hidden text-left hover:shadow-md transition flex flex-col"
              >
                <div className="app-photo-cover-frame w-full overflow-hidden bg-muted">
                  {image ? (
                    <img
                      src={image}
                      alt={label}
                      loading="lazy"
                      className="app-photo-cover-image"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-3xl">🍽️</div>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-medium text-sm leading-tight">{label}</div>
                  <div className="text-xs muted mt-1">
                    {count} {count === 1 ? "receta" : "recetas"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {(selectedCat || q) && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium text-sm">
              {selectedCat ? getCategoryLabel(selectedCat) : "Resultados"}
            </div>
            {selectedCat && (
              <button onClick={() => { setSelectedCat(null); setQ(""); }} className="text-xs muted inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Categorías
              </button>
            )}
          </div>
          {filtered.length === 0 ? (
            <div className="card-soft p-8 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-3">
                <Clock className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <div className="font-medium mb-1">Próximamente</div>
              <p className="text-sm muted">
                Estamos preparando recetas deliciosas para esta categoría. Vuelve pronto.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => {
                const category = normalizeCategory(r.category);
                const cover = r.image_url || getCategoryImage(category);
                return (
                  <button
                    key={r.id}
                    onClick={() => openRecipe(r.id)}
                    className="recipe-premium rounded-[22px] bg-white/90 w-full text-left transition overflow-hidden flex"
                  >
                    {cover && (
                      <div className="library-recipe-thumb shrink-0 bg-muted">
                        <img src={cover} alt={r.title} loading="lazy" className="app-photo-cover-image transition-transform duration-500 hover:scale-105" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      </div>
                    )}
                    <div className="p-3 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {r.is_featured && <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />}
                        <div className="font-medium truncate">{r.title}</div>
                      </div>
                      <div className="mt-1.5 grid grid-cols-5 gap-1 text-[10px] text-center">
                        <div className="nutrition-stat"><div className="font-semibold">{r.macros?.calories ?? 0}</div><div className="muted">Kcal</div></div>
                        <div className="nutrition-stat"><div className="font-semibold">{r.macros?.protein ?? 0}g</div><div className="muted">Prot</div></div>
                        <div className="nutrition-stat"><div className="font-semibold">{r.macros?.carbs ?? 0}g</div><div className="muted">Carb</div></div>
                        <div className="nutrition-stat"><div className="font-semibold">{r.macros?.fat ?? 0}g</div><div className="muted">Grasa</div></div>
                        <div className="nutrition-stat"><div className="font-semibold">{r.macros?.fiber ?? 0}g</div><div className="muted">Fibra</div></div>
                      </div>
                      {(category || r.category) && !selectedCat && (
                        <div className="text-[10px] muted mt-1 truncate">{category ? getCategoryLabel(category) : r.category}</div>
                      )}
                    </div>

                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
