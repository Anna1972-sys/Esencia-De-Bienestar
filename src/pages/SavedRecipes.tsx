import { useEffect, useState, type ChangeEvent } from "react";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, ShoppingBag, ArrowLeft, ChefHat, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { normalizeRecipeImageUrl, recipeImagePublicUrl } from "@/lib/recipeImages";

const macroValue = (macros: any, key: string) => Number(macros?.[key] ?? 0);
const hasNutrition = (macros: any) =>
  ["calories", "protein", "carbs", "fat", "fiber"].some(key => macroValue(macros, key) > 0);
const nutritionLabel = (macros: any) =>
  macros?.nutrition_status === "verified" ? "Valores verificados" : "Valores estimados";
const firstUrl = (...values: any[]) =>
  values.find(value => typeof value === "string" && value.trim())?.trim() ?? "";

export default function SavedRecipes() {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmRecipe, setConfirmRecipe] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(() => new Set());

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
    setBrokenImageIds(new Set());
    setItems((data ?? []).map((item: any) => ({ ...item, image_url: normalizeRecipeImageUrl(item.image_url) })));
    setLoading(false);
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

  const uploadRecipeImage = async (event: ChangeEvent<HTMLInputElement>, recipe: any) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user || !recipe?.id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen válida.");
      return;
    }
    setUploadingImageId(recipe.id);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `manual/${user.id}/${recipe.id}-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-images")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const imageUrl = recipeImagePublicUrl(path);

      const { error: updateError } = await supabase
        .from("recipes")
        .update({ image_url: imageUrl } as any)
        .eq("id", recipe.id)
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      setItems(current => current.map(item => item.id === recipe.id ? { ...item, image_url: imageUrl } : item));
      toast.success("Imagen guardada correctamente.");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo subir la imagen.");
    } finally {
      setUploadingImageId(null);
    }
  };

  const clearRecipeImage = async (recipe: any) => {
    if (!user || !recipe?.id) return;
    if (!confirm("¿Seguro que deseas eliminar esta imagen?")) return;
    setUploadingImageId(recipe.id);
    try {
      const { error } = await supabase
        .from("recipes")
        .update({ image_url: null } as any)
        .eq("id", recipe.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setItems(current => current.map(item => item.id === recipe.id ? { ...item, image_url: null } : item));
      toast.success("Imagen eliminada correctamente.");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo eliminar la imagen.");
    } finally {
      setUploadingImageId(null);
    }
  };

  const generateRecipeImage = async (recipe: any) => {
    if (!user || !recipe?.id) return;
    if (!isAdmin) {
      toast.error("Solo la administradora puede generar imágenes.");
      return;
    }
    if (generatingImageId) return;
    setGeneratingImageId(recipe.id);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (sessionError || !token) throw new Error("Vuelve a iniciar sesión para generar la imagen.");

      const response = await fetch("/api/generate-recipe-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipe }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo generar la imagen con Gemini.");
      }

      const imageUrl = normalizeRecipeImageUrl(firstUrl(payload?.image_url));
      if (!imageUrl) {
        throw new Error(payload?.storage_warning || "Gemini creó la imagen, pero no se pudo guardar de forma permanente.");
      }

      const { error: updateError } = await supabase
        .from("recipes")
        .update({ image_url: imageUrl } as any)
        .eq("id", recipe.id)
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      setItems(current => current.map(item => item.id === recipe.id ? { ...item, image_url: imageUrl } : item));
      setBrokenImageIds(current => {
        const next = new Set(current);
        next.delete(recipe.id);
        return next;
      });
      toast.success("Imagen creada con Gemini y guardada correctamente.");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo generar la imagen.");
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
            const recipeImageUrl = normalizeRecipeImageUrl(firstUrl(r.image_url));
            const imageIsBroken = brokenImageIds.has(r.id);
            const hasImage = Boolean(recipeImageUrl) && !imageIsBroken;
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
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          setBrokenImageIds(current => new Set(current).add(r.id));
                        }}
                      />
                    )}
                    {!hasImage && isAdmin && (
                      <div className="absolute inset-x-2 bottom-2 rounded-2xl bg-white/90 border border-primary/20 px-2 py-1 text-center text-[10px] font-semibold text-primary shadow-sm">
                        Imagen pendiente
                      </div>
                    )}
                  </div>
                  <div className="saved-recipe-content p-4 grid grid-cols-[minmax(0,1fr)_92px] gap-2 items-start min-w-0">
                    <div className="min-w-0 self-center">
                      <div className="saved-recipe-title font-semibold text-lg leading-tight">{r.title}</div>
                      <div className="text-[11px] leading-relaxed muted mt-2.5">
                        {r.prep_time ?? "—"} min · {nutritionAvailable ? nutritionLabel(macros) : "Nutrición no registrada"}
                      </div>
                    </div>
                    <div className="saved-recipe-actions flex flex-col items-center justify-center gap-2 shrink-0 self-center">
                        {nutritionAvailable && isHighProtein ? (
                          <span className="chip saved-recipe-chip">Alta proteína</span>
                        ) : (
                          <span className="saved-recipe-chip-placeholder" aria-hidden="true" />
                        )}
                        <span className="saved-recipe-view-btn">Ver</span>
                        {isAdmin && !hasImage && (
                          <button
                            type="button"
                            className="saved-recipe-view-btn text-[10px] px-2"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              generateRecipeImage(r);
                            }}
                            disabled={generatingImageId === r.id}
                          >
                            {generatingImageId === r.id ? "Generando…" : "Imagen"}
                          </button>
                        )}
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
                {isAdmin && (
                  <div className="rounded-2xl border border-primary/20 bg-white/80 p-3">
                    <div className="font-medium mb-2">Imagen de la receta</div>
                    {hasImage && (
                      <img
                        src={recipeImageUrl}
                        alt={r.title}
                        className="mb-3 h-32 w-full rounded-2xl object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          setBrokenImageIds(current => new Set(current).add(r.id));
                        }}
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <label className={`btn-primary text-xs cursor-pointer ${uploadingImageId === r.id ? "opacity-70 pointer-events-none" : ""}`}>
                        {uploadingImageId === r.id ? "Subiendo…" : hasImage ? "Cambiar imagen" : "Subir imagen"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingImageId === r.id}
                          onChange={(event) => uploadRecipeImage(event, r)}
                        />
                      </label>
                      {!hasImage && (
                        <button
                          type="button"
                          className="btn-ghost text-xs"
                          onClick={() => generateRecipeImage(r)}
                          disabled={generatingImageId === r.id || uploadingImageId === r.id}
                        >
                          <Sparkles className="h-3 w-3" />
                          {generatingImageId === r.id ? "Generando imagen…" : "Generar imagen con Gemini"}
                        </button>
                      )}
                      {hasImage && (
                        <button
                          type="button"
                          className="btn-ghost text-xs text-destructive"
                          onClick={() => clearRecipeImage(r)}
                          disabled={uploadingImageId === r.id}
                        >
                          Eliminar imagen
                        </button>
                      )}
                    </div>
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
