import { useEffect, useState } from "react";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, ShoppingBag, ArrowLeft, ChefHat, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const macroValue = (macros: any, key: string) => Number(macros?.[key] ?? 0);
const hasNutrition = (macros: any) =>
  ["calories", "protein", "carbs", "fat", "fiber"].some(key => macroValue(macros, key) > 0);
const nutritionLabel = (macros: any) =>
  macros?.nutrition_status === "verified" ? "Valores verificados" : "Valores estimados";
const firstUrl = (...values: any[]) =>
  values.find(value => typeof value === "string" && value.trim())?.trim() ?? "";
const imageErrorLabel = (recipe: any) =>
  String(recipe?.macros?.image_generation_error ?? "").trim();

export default function SavedRecipes() {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmRecipe, setConfirmRecipe] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from("recipes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) {
      console.error("[mis-recetas] error cargando recetas", error);
      toast.error(`No se pudieron cargar tus recetas: ${error.message}`);
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const remove = async (recipe: any) => {
    if (!recipe?.id || !user) return;
    if (!isAdmin) {
      toast.error("Solo la administradora puede eliminar recetas.");
      setConfirmRecipe(null);
      return;
    }
    setDeletingId(recipe.id);
    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id).eq("user_id", user.id);
    setDeletingId(null);
    if (error) {
      toast.error(`No se pudo eliminar la receta: ${error.message}`);
      return;
    }
    setItems(current => current.filter(r => r.id !== recipe.id));
    setConfirmRecipe(null);
    toast.success("Receta eliminada correctamente.");
  };
  const addToShopping = async (r: any) => {
    if (!user) return;
    const rows = (r.ingredients ?? []).map((i: any) => ({
      user_id: user.id,
      name: typeof i === "string" ? i : i.name ?? String(i),
      quantity: typeof i === "string" ? null : i.quantity ?? null,
      recipe_id: r.id,
    }));
    if (!rows.length) return;
    const { error } = await supabase.from("shopping_list_items").insert(rows);
    if (error) toast.error(error.message); else toast.success("Añadido a la lista");
  };

  const generateRecipeImage = async (recipe: any) => {
    if (!user || !recipe?.id || generatingImageId) return;
    setGeneratingImageId(recipe.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/generate-recipe-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
        },
        body: JSON.stringify({
          title: recipe.title,
          ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
          preparation: Array.isArray(recipe.steps) ? recipe.steps : [],
          recipe,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Error de OpenAI o conexión al generar la imagen.");
      }
      const persistentUrl = data?.persistent === false ? "" : firstUrl(data?.image_url, data?.url);
      if (!persistentUrl) {
        throw new Error(data?.storage_warning || "La imagen se creó, pero no pudo guardarse en Storage.");
      }

      const nextMacros = {
        ...(recipe.macros ?? {}),
        image_generation_status: "ready",
        image_generation_error: "",
      };
      const { error } = await supabase
        .from("recipes")
        .update({ image_url: persistentUrl, macros: nextMacros } as any)
        .eq("id", recipe.id)
        .eq("user_id", user.id);
      if (error) throw error;

      setItems(current => current.map(item => item.id === recipe.id ? { ...item, image_url: persistentUrl, macros: nextMacros } : item));
      toast.success("Imagen generada y guardada correctamente.");
    } catch (err: any) {
      const message = String(err?.message || "No se pudo generar la imagen.").trim();
      const nextMacros = {
        ...(recipe.macros ?? {}),
        image_generation_status: "pending",
        image_generation_error: message,
      };
      await supabase
        .from("recipes")
        .update({ macros: nextMacros } as any)
        .eq("id", recipe.id)
        .eq("user_id", user.id);
      setItems(current => current.map(item => item.id === recipe.id ? { ...item, macros: nextMacros } : item));
      toast.error(`No se pudo generar la imagen: ${message}`);
    } finally {
      setGeneratingImageId(null);
    }
  };

  const filtered = items.filter(r => String(r.title ?? "").toLowerCase().includes(String(q ?? "").toLowerCase()));

  return (
    <div className="saved-recipes-page">
      <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>
      <h1 className="heading-lg mb-3">Mis recetas</h1>
      <input value={q} onChange={e => setQ(e.target.value)} className="field mb-4" placeholder="Buscar…" />
      {loading ? <p className="muted">Cargando…</p> : filtered.length === 0 ? (
        <div className="card-soft p-6 text-center muted">Aún no tienes recetas. Crea una con el generador IA.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(r => {
            const macros = r.macros ?? {};
            const nutritionAvailable = hasNutrition(macros);
            const isHighProtein = nutritionAvailable && macroValue(macros, "protein") >= 25;
            const recipeImageUrl = firstUrl(r.image_url);
            const hasImage = Boolean(recipeImageUrl);
            const imagePending = !hasImage;
            const imageError = imageErrorLabel(r);
            const generatingThisImage = generatingImageId === r.id;
            return <details key={r.id} className="recipe-premium saved-recipe-card rounded-[24px] bg-white/90 group">
              <summary className="block cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="saved-recipe-summary grid grid-cols-[42%_1fr] h-[142px] items-stretch">
                  <div className="recipe-premium-image relative h-full overflow-hidden bg-gradient-to-br from-white via-primary/10 to-primary/20">
                    <div className="absolute inset-0 grid place-items-center text-primary/70">
                      <div className="h-14 w-14 rounded-2xl bg-white/80 border border-primary/20 grid place-items-center shadow-sm">
                        <ChefHat className="h-7 w-7" />
                      </div>
                    </div>
                    {hasImage && (
                      <img
                        src={recipeImageUrl}
                        alt={r.title}
                        loading="lazy"
                        className="relative h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>
                  <div className="saved-recipe-content p-4 grid grid-cols-[minmax(0,1fr)_92px] gap-2 items-start min-w-0">
                    <div className="min-w-0 self-center">
                      <div className="saved-recipe-title font-semibold text-lg leading-tight">{r.title}</div>
                      <div className="text-[11px] leading-relaxed muted mt-2.5">
                        {r.prep_time ?? "—"} min · {nutritionAvailable ? nutritionLabel(macros) : "Nutrición no registrada"}
                      </div>
                      {imagePending && <div className="text-[11px] font-semibold text-primary mt-1">Imagen pendiente</div>}
                    </div>
                    <div className="saved-recipe-actions flex flex-col items-center justify-center gap-2 shrink-0 self-center">
                        {nutritionAvailable && isHighProtein ? (
                          <span className="chip saved-recipe-chip">Alta proteína</span>
                        ) : (
                          <span className="saved-recipe-chip-placeholder" aria-hidden="true" />
                        )}
                        <span className="saved-recipe-view-btn">Ver</span>
                        {isAdmin && (
                          <button
                            type="button"
                            aria-label="Eliminar receta"
                            className="saved-recipe-delete-btn btn-ghost text-destructive"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setConfirmRecipe(r);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Eliminar</span>
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              </summary>
              <div className="text-sm px-4 pb-4 space-y-3">
                <h2 className="font-semibold text-lg leading-tight text-foreground pt-1">{r.title}</h2>
                {imagePending && (
                  <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3">
                    <div className="font-semibold text-primary">Imagen pendiente</div>
                    {isAdmin && imageError && <p className="text-xs muted mt-1">{imageError}</p>}
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn-primary w-full mt-3"
                        onClick={() => generateRecipeImage(r)}
                        disabled={generatingThisImage}
                      >
                        {generatingThisImage ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando imagen…</> : <><ImagePlus className="h-4 w-4" /> Generar imagen</>}
                      </button>
                    )}
                  </div>
                )}
                <p className="muted">{r.description}</p>
                <div>
                  {nutritionAvailable && (
                    <div className="mb-3">
                      <div className="font-medium mb-1">Información nutricional por ración</div>
                      <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                        <Macro label="Kcal" value={macroValue(macros, "calories")} />
                        <Macro label="Prot" value={`${macroValue(macros, "protein")}g`} />
                        <Macro label="Hidr" value={`${macroValue(macros, "carbs")}g`} />
                        <Macro label="Grasa" value={`${macroValue(macros, "fat")}g`} />
                        <Macro label="Fibra" value={`${macroValue(macros, "fiber")}g`} />
                      </div>
                    </div>
                  )}
                  <div className="font-medium mb-1">Ingredientes</div>
                  <ul className="list-disc pl-5 muted">{(r.ingredients ?? []).map((i: any, k: number) => <li key={k}>{typeof i === "string" ? i : `${i.quantity ?? ""} ${i.name ?? ""}`}</li>)}</ul>
                </div>
                <div>
                  <div className="font-medium mb-1">Pasos</div>
                  <ol className="list-decimal pl-5 space-y-1">{(r.steps ?? []).map((s: string, k: number) => <li key={k}>{s}</li>)}</ol>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => addToShopping(r)} className="btn-ghost text-xs"><ShoppingBag className="h-3 w-3" /> A la lista</button>
                  {isAdmin && (
                    <button onClick={() => setConfirmRecipe(r)} className="btn-ghost text-xs text-destructive"><Trash2 className="h-3 w-3" /> Eliminar</button>
                  )}
                </div>
              </div>
            </details>;
          })}
        </div>
      )}
      {confirmRecipe && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
          <div className="card-soft w-full max-w-sm p-5 shadow-xl">
            <div className="font-semibold text-lg mb-2">Eliminar receta</div>
            <p className="text-sm muted mb-4">¿Seguro que deseas eliminar esta receta?</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmRecipe(null)}
                disabled={deletingId === confirmRecipe.id}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => remove(confirmRecipe)}
                disabled={deletingId === confirmRecipe.id}
              >
                {deletingId === confirmRecipe.id ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Macro({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-secondary px-1 py-2">
      <div className="font-semibold text-foreground">{value || "—"}</div>
      <div className="muted uppercase tracking-wide text-[9px] mt-0.5">{label}</div>
    </div>
  );
}
