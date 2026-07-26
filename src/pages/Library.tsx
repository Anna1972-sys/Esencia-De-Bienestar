import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search, Sparkles, Clock, Info } from "lucide-react";
import { LIBRARY_CATEGORIES, getCategoryLabel } from "@/lib/libraryCategories";
import { normalizeRecipeImageUrl } from "@/lib/recipeImages";
import { type LibraryContext, resolveLibraryReturnContext, saveLibraryReturnContext } from "@/lib/libraryNavigation";
import BackButton from "@/components/BackButton";
import WellnessCategoryTile from "@/components/WellnessCategoryTile";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import { recordAppError } from "@/lib/appErrorLogger";

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
  sort_order?: number | null;
};

export default function Library() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeContext = (location.state as { libraryContext?: LibraryContext } | null)?.libraryContext;
  const returnContext = routeContext ? resolveLibraryReturnContext(routeContext) : null;
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

  const manualRecipeOrder = (recipe: Recipe) => {
    const value = Number(recipe.sort_order ?? 0);
    return Number.isFinite(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
  };

  const applyManualRecipeOrder = (list: Recipe[]) => {
    if (!list.some(recipe => manualRecipeOrder(recipe) !== Number.MAX_SAFE_INTEGER)) return list;
    return [...list].sort((a, b) => {
      const orderDiff = manualRecipeOrder(a) - manualRecipeOrder(b);
      if (orderDiff !== 0) return orderDiff;
      if (Boolean(a.is_featured) !== Boolean(b.is_featured)) return Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
      return String(a.title ?? "").localeCompare(String(b.title ?? ""), "es", { sensitivity: "base" });
    });
  };

  const isCalorieGuidance = (recipe: Recipe) => {
    const text = `${recipe.title ?? ""} ${recipe.description ?? ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return (
      (text.includes("orientacion") && text.includes("caloria")) ||
      (text.includes("repetir") && text.includes("almuerzo") && text.includes("merienda"))
    );
  };

  const isFormulaGuidance = (recipe: Recipe) =>
    String(recipe.title ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes("formula");

  const load = () =>
    supabase
      .from("recipes")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("title")
      .then(({ data, error }) => {
        if (error) {
          recordAppError({
            area: "supabase",
            action: "Cargar Biblioteca de recetas",
            error,
            userMessage: "La Biblioteca de recetas no pudo cargar su contenido.",
          });
          return;
        }
        setItems(((data as any) ?? []).filter(isVisibleLibraryRecipe));
      });

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
    items.filter(recipe => !isCalorieGuidance(recipe)).forEach(r => {
      const category = normalizeCategory(r.category);
      if (category) m[category] = (m[category] ?? 0) + 1;
    });
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    const query = String(q ?? "").trim().toLowerCase();
    let list = items.filter(recipe => !isCalorieGuidance(recipe));
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
    const ordered = applyManualRecipeOrder(list);
    if (selectedCat === "desayunos_sin_herbalife") {
      return [...ordered].sort((a, b) => Number(isFormulaGuidance(b)) - Number(isFormulaGuidance(a)));
    }
    return ordered;
  }, [items, selectedCat, q]);

  const calorieGuidance = useMemo(
    () => items.find(recipe => isCalorieGuidance(recipe)),
    [items],
  );
  const positiveGuidanceValue = (value: unknown, fallback: number) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  };
  const guidanceSettings = {
    caloriesMin: positiveGuidanceValue(calorieGuidance?.macros?.guidance_calories_min, 150),
    caloriesMax: positiveGuidanceValue(calorieGuidance?.macros?.guidance_calories_max, 170),
    proteinMin: positiveGuidanceValue(calorieGuidance?.macros?.guidance_protein_min, 10),
    proteinMax: positiveGuidanceValue(calorieGuidance?.macros?.guidance_protein_max, 20),
    lunchImage:
      normalizeRecipeImageUrl(calorieGuidance?.image_url) ||
      LIBRARY_CATEGORIES.find(item => item.id === "comidas")?.image,
    snackImage:
      normalizeRecipeImageUrl(calorieGuidance?.macros?.guidance_image_secondary) ||
      LIBRARY_CATEGORIES.find(item => item.id === "meriendas")?.image,
    mealImage:
      normalizeRecipeImageUrl(calorieGuidance?.macros?.guidance_meal_image) ||
      LIBRARY_CATEGORIES.find(item => item.id === "comidas")?.image,
    mealCaloriesMax: positiveGuidanceValue(calorieGuidance?.macros?.guidance_meal_calories_max, 500),
    mealProteinMin: positiveGuidanceValue(calorieGuidance?.macros?.guidance_meal_protein_min, 20),
    mealProteinMax: positiveGuidanceValue(calorieGuidance?.macros?.guidance_meal_protein_max, 35),
    dinnerImage:
      normalizeRecipeImageUrl(calorieGuidance?.macros?.guidance_dinner_image) ||
      LIBRARY_CATEGORIES.find(item => item.id === "cenas_sin_herbalife")?.image,
    dinnerCaloriesMax: positiveGuidanceValue(calorieGuidance?.macros?.guidance_dinner_calories_max, 300),
    dinnerProteinMin: positiveGuidanceValue(calorieGuidance?.macros?.guidance_dinner_protein_min, 20),
    dinnerProteinMax: positiveGuidanceValue(calorieGuidance?.macros?.guidance_dinner_protein_max, 30),
    breakfastImage: normalizeRecipeImageUrl(calorieGuidance?.macros?.guidance_breakfast_image),
    breakfastCaloriesMax: positiveGuidanceValue(calorieGuidance?.macros?.guidance_breakfast_calories_max, 250),
    breakfastProteinMin: positiveGuidanceValue(calorieGuidance?.macros?.guidance_breakfast_protein_min, 25),
    breakfastProteinMax: positiveGuidanceValue(calorieGuidance?.macros?.guidance_breakfast_protein_max, 30),
  };

  useEffect(() => {
    if (returnContext?.scrollY == null || items.length === 0) return;
    const frame = requestAnimationFrame(() => window.scrollTo(0, returnContext.scrollY));
    return () => cancelAnimationFrame(frame);
  }, [items.length, returnContext?.scrollY]);

  const openRecipe = (id: string) => {
    const libraryContext = {
      selectedCat,
      query: q,
      scrollY: window.scrollY,
    } satisfies LibraryContext;
    saveLibraryReturnContext(libraryContext);

    navigate(`/app/biblioteca/${id}`, {
      state: {
        recipeBackTo: "/app/biblioteca",
        libraryContext,
      },
    });
  };


  return (
    <div className="library-recipes-page pb-28">
      <BackButton
        fallbackTo="/app"
        className="text-sm muted inline-flex items-center gap-1 mb-3"
        onClick={(event) => {
          if (!selectedCat && !q) return;
          event.preventDefault();
          setSelectedCat(null);
          setQ("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>
      <h1 className="heading-lg mb-1">Biblioteca de recetas</h1>
      <p className="muted text-sm mb-4">Recetas oficiales seleccionadas para ti.</p>


      <div className="relative mb-5">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 muted" />
        <input
          className="field pl-9"
          placeholder="¿Qué ingrediente te apetece?"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>
      <p className="-mt-3 mb-5 px-1 text-xs muted">
        Prueba: plátano, chocolate, fresa, café…
      </p>

      {!selectedCat && !q && (
        <div className="grid grid-cols-2 gap-5">
          {LIBRARY_CATEGORIES.map(({ id, label, image }) => {
            const count = counts[id] ?? 0;
            return (
              <div key={id} className="home-card-unified">
                <WellnessCategoryTile
                  image={image ?? ""}
                  title={label}
                  subtitle={count > 0 ? `${count} ${count === 1 ? "receta" : "recetas"}` : undefined}
                  onClick={() => setSelectedCat(id)}
                />
              </div>
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
              {(selectedCat === "comidas" || selectedCat === "cenas_sin_herbalife") && !q.trim() && (() => {
                const isDinner = selectedCat === "cenas_sin_herbalife";
                const image = isDinner ? guidanceSettings.dinnerImage : guidanceSettings.mealImage;
                const caloriesMax = isDinner ? guidanceSettings.dinnerCaloriesMax : guidanceSettings.mealCaloriesMax;
                const proteinMin = isDinner ? guidanceSettings.dinnerProteinMin : guidanceSettings.mealProteinMin;
                const proteinMax = isDinner ? guidanceSettings.dinnerProteinMax : guidanceSettings.mealProteinMax;
                return (
                  <div className="recipe-premium flex min-h-[10rem] w-full overflow-hidden rounded-[22px] bg-white/90 text-left transition">
                    {image && (
                      <div className="library-recipe-thumb h-auto min-h-[10rem] shrink-0 self-stretch bg-muted">
                        <img src={image} alt="" className="app-photo-cover-image transition-transform duration-500 hover:scale-105" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
                      <div className="font-medium leading-tight">
                        {isDinner ? "Cómo preparar una cena equilibrada" : "Cómo preparar una comida completa"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          Menos de {caloriesMax} kcal
                        </span>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                          {proteinMin}–{proteinMax} g de proteína
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
                        Esta orientación es general. Consulta con tu asesora para adaptarla a tu objetivo personal.
                      </p>
                    </div>
                  </div>
                );
              })()}
              {(selectedCat === "snacks" || selectedCat === "meriendas") && !q.trim() && (() => {
                return (
                  <div className="w-full overflow-hidden rounded-[24px] border border-primary/25 bg-gradient-to-br from-white via-primary/[0.045] to-secondary/70 p-4 text-left shadow-[0_16px_32px_-24px_hsl(var(--primary)/0.55)]">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
                        <Info className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                          Orientación nutricional
                        </div>
                        <div className="mt-0.5 text-lg font-semibold leading-tight">
                          Alterna tus snacks y meriendas
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/75 text-center">
                        {guidanceSettings.lunchImage && <img src={guidanceSettings.lunchImage} alt="" className="h-20 w-full object-cover" />}
                        <div className="p-2.5">
                          <div className="text-xs font-medium">Almuerzo</div>
                          <div className="mt-0.5 text-sm font-semibold text-primary">Entre {guidanceSettings.caloriesMin} y {guidanceSettings.caloriesMax} kcal</div>
                          <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">Entre {guidanceSettings.proteinMin} y {guidanceSettings.proteinMax} g de proteína</div>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/75 text-center">
                        {guidanceSettings.snackImage && <img src={guidanceSettings.snackImage} alt="" className="h-20 w-full object-cover" />}
                        <div className="p-2.5">
                          <div className="text-xs font-medium">Merienda</div>
                          <div className="mt-0.5 text-sm font-semibold text-primary">Entre {guidanceSettings.caloriesMin} y {guidanceSettings.caloriesMax} kcal</div>
                          <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">Entre {guidanceSettings.proteinMin} y {guidanceSettings.proteinMax} g de proteína</div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                      Varía las opciones durante la semana para mantener una alimentación equilibrada.
                    </p>
                    <p className="mt-1.5 text-center text-[11px] leading-relaxed text-muted-foreground">
                      Esta orientación es general. Consulta con tu asesora para adaptarla a tu objetivo personal.
                    </p>
                  </div>
                );
              })()}
              {filtered.map(r => {
                const category = normalizeCategory(r.category);
                const cover = normalizeRecipeImageUrl(r.image_url);
                if (isFormulaGuidance(r)) {
                  const formulaCover = guidanceSettings.breakfastImage || cover;
                  return (
                    <button
                      key={r.id}
                      onClick={() => openRecipe(r.id)}
                      className="recipe-premium formula-guidance-card rounded-[22px] w-full text-left transition overflow-hidden flex"
                    >
                      {formulaCover && (
                        <div className="library-recipe-thumb formula-guidance-thumb shrink-0 self-stretch bg-muted">
                          <img
                            src={formulaCover}
                            alt={r.title}
                            loading="lazy"
                            className="app-photo-cover-image transition-transform duration-500 hover:scale-105"
                          />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
                        <div className="font-medium leading-tight">Cómo preparar un desayuno completo</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                            Menos de {guidanceSettings.breakfastCaloriesMax} kcal
                          </span>
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                            {guidanceSettings.breakfastProteinMin}–{guidanceSettings.breakfastProteinMax} g de proteína
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
                          Esta orientación es general. Consulta con tu asesora para adaptarla a tu objetivo personal.
                        </p>
                      </div>
                    </button>
                  );
                }
                if (isCalorieGuidance(r)) {
                  const guidanceCalories = r.macros?.calories ?? 200;
                  const lunchImage = LIBRARY_CATEGORIES.find(item => item.id === "comidas")?.image;
                  const snackImage = LIBRARY_CATEGORIES.find(item => item.id === "meriendas")?.image;
                  return (
                    <button
                      key={r.id}
                      onClick={() => openRecipe(r.id)}
                      className="w-full overflow-hidden rounded-[24px] border border-primary/25 bg-gradient-to-br from-white via-primary/[0.045] to-secondary/70 p-4 text-left shadow-[0_16px_32px_-24px_hsl(var(--primary)/0.55)] transition hover:-translate-y-0.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
                          <Info className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                            Orientación de calorías
                          </div>
                          <div className="mt-0.5 text-lg font-semibold leading-tight">
                            Alterna tus snacks y meriendas
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/75 text-center">
                          {lunchImage && (
                            <img src={lunchImage} alt="" className="h-20 w-full object-cover" />
                          )}
                          <div className="p-2.5">
                            <div className="text-xs font-medium">Almuerzo</div>
                            <div className="mt-0.5 text-sm font-semibold text-primary">Hasta {guidanceCalories} kcal</div>
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/75 text-center">
                          {snackImage && (
                            <img src={snackImage} alt="" className="h-20 w-full object-cover" />
                          )}
                          <div className="p-2.5">
                            <div className="text-xs font-medium">Merienda</div>
                            <div className="mt-0.5 text-sm font-semibold text-primary">Hasta {guidanceCalories} kcal</div>
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                        Varía las opciones durante la semana para mantener una alimentación equilibrada.
                      </p>
                    </button>
                  );
                }
                return (
                  <div key={r.id} className="relative">
                    <FavoriteButton contentType="recipe" contentId={r.id} className="absolute right-2 top-2 z-10" />
                    <button
                      onClick={() => openRecipe(r.id)}
                      className="recipe-premium rounded-[22px] bg-white/90 w-full text-left transition overflow-hidden flex"
                    >
                      {cover && (
                        <div className="library-recipe-thumb shrink-0 bg-muted">
                          <img
                            src={cover}
                            alt={r.title}
                            loading="lazy"
                            className="app-photo-cover-image transition-transform duration-500 hover:scale-105"
                            onError={(e) => {
                              const image = e.currentTarget as HTMLImageElement;
                              image.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <div className="p-3 pr-11 flex-1 min-w-0">
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
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
