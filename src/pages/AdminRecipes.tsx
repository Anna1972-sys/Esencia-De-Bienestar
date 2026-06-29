import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Calculator, Copy, Eye, Plus, Save, Sparkles, Star, Trash2, Upload, X } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";
import { LIBRARY_CATEGORIES, getCategoryLabel } from "@/lib/libraryCategories";
import VideoField from "@/components/VideoField";
import { calculateWithMacroSpecialist, macrosFromSpecialist } from "@/lib/macroSpecialistClient";

const CONFIRM_DELETE = "¿Estás segura de que deseas eliminar esta receta oficial? Esta acción no se puede deshacer.";
const QTY_RE = /\d/;

type OfficialStatus = "visible" | "hidden" | "featured";

type RecipeRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  categories?: string[] | null;
  tags?: string[] | null;
  ingredients: any;
  steps: any;
  macros: any;
  image_url: string | null;
  video_url: string | null;
  is_featured: boolean | null;
  is_library: boolean | null;
  is_high_protein?: boolean | null;
  visibility?: string | null;
  prep_time?: number | null;
  servings?: number | null;
  user_id?: string | null;
  source_user_id?: string | null;
  created_at?: string | null;
};

type LibForm = {
  title: string;
  description: string;
  category: string;
  status: OfficialStatus;
  protein: string;
  carbs: string;
  fat: string;
  calories: string;
  fiber: string;
  prep_time: string;
  servings: string;
  ingredients: string;
  steps: string;
  tags: string;
  image_url: string;
  video_url: string;
};

const emptyForm: LibForm = {
  title: "",
  description: "",
  category: LIBRARY_CATEGORIES[0].id,
  status: "visible",
  protein: "0",
  carbs: "0",
  fat: "0",
  calories: "0",
  fiber: "0",
  prep_time: "",
  servings: "1",
  ingredients: "",
  steps: "",
  tags: "",
  image_url: "",
  video_url: "",
};

const parseLines = (text: string) => text.split("\n").map(s => s.trim()).filter(Boolean);
const parseTags = (text: string) => text.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
const tagsToText = (tags: any) => Array.isArray(tags) ? tags.map(String).join(", ") : "";
const numberText = (value: any) => Number.isFinite(Number(value)) ? String(value) : "0";
const numberOrNull = (value: string) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
};
const macroNumber = (value: string) => {
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : 0;
};

const ingredientsToText = (ingredients: any) =>
  Array.isArray(ingredients)
    ? ingredients.map((item: any) => {
      if (typeof item === "string") return item;
      const quantity = item?.quantity ?? (item?.grams ? `${item.grams} g` : "");
      return `${quantity ?? ""} ${item?.name ?? ""}`.trim();
    }).filter(Boolean).join("\n")
    : "";

const stepsToText = (steps: any) =>
  Array.isArray(steps)
    ? steps.map((step: any) => typeof step === "string" ? step : step?.text ?? "").filter(Boolean).join("\n")
    : "";

const recipeStatus = (recipe: RecipeRow): OfficialStatus => {
  if (!recipe.is_library) return "hidden";
  if (recipe.is_featured || recipe.visibility === "featured") return "featured";
  return "visible";
};

const statusPayload = (status: OfficialStatus) => ({
  is_library: status !== "hidden",
  is_featured: status === "featured",
  visibility: status === "featured" ? "featured" : status === "hidden" ? "private" : "community",
});

const macrosFromForm = (form: LibForm, existing: any = {}) => ({
  ...(existing ?? {}),
  calories: macroNumber(form.calories),
  protein: macroNumber(form.protein),
  carbs: macroNumber(form.carbs),
  fat: macroNumber(form.fat),
  fiber: macroNumber(form.fiber),
  prep_time: form.prep_time.trim() || undefined,
  servings: form.servings.trim() || undefined,
  nutrition_status: existing?.nutrition_status ?? "pending_review",
  nutrition_note: existing?.nutrition_note ?? "pendiente de revisión",
});

const formFromRecipe = (recipe: RecipeRow): LibForm => ({
  title: recipe.title ?? "",
  description: recipe.description ?? "",
  category: recipe.category ?? LIBRARY_CATEGORIES[0].id,
  status: recipeStatus(recipe),
  protein: numberText(recipe.macros?.protein),
  carbs: numberText(recipe.macros?.carbs),
  fat: numberText(recipe.macros?.fat),
  calories: numberText(recipe.macros?.calories),
  fiber: numberText(recipe.macros?.fiber),
  prep_time: String(recipe.prep_time ?? recipe.macros?.prep_time ?? ""),
  servings: String(recipe.servings ?? recipe.macros?.servings ?? "1"),
  ingredients: ingredientsToText(recipe.ingredients),
  steps: stepsToText(recipe.steps),
  tags: tagsToText(recipe.tags),
  image_url: recipe.image_url ?? "",
  video_url: recipe.video_url ?? "",
});

const missingIngredientNames = (data: any) => [
  ...(data?.notFound ?? []).map((item: any) => item?.name ?? item).filter(Boolean),
  ...(data?.missingGrams ?? []).map((item: any) => item?.name ?? item).filter(Boolean),
];

function MacroGrid({ values }: { values: Pick<LibForm, "calories" | "protein" | "carbs" | "fat" | "fiber"> }) {
  return (
    <div className="grid grid-cols-5 gap-2 text-center text-xs">
      <div className="card-soft p-2"><div className="font-semibold">{values.calories || 0}</div><div className="muted">kcal</div></div>
      <div className="card-soft p-2"><div className="font-semibold">{values.protein || 0}g</div><div className="muted">Prot</div></div>
      <div className="card-soft p-2"><div className="font-semibold">{values.carbs || 0}g</div><div className="muted">Carb</div></div>
      <div className="card-soft p-2"><div className="font-semibold">{values.fat || 0}g</div><div className="muted">Grasa</div></div>
      <div className="card-soft p-2"><div className="font-semibold">{values.fiber || 0}g</div><div className="muted">Fibra</div></div>
    </div>
  );
}

export default function AdminRecipes() {
  const [items, setItems] = useState<RecipeRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LibForm>(emptyForm);
  const [filterCat, setFilterCat] = useState("");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [macroDebug, setMacroDebug] = useState<any[]>([]);
  const [lastMacroWarning, setLastMacroWarning] = useState("");

  const editingRecipe = useMemo(() => items.find(item => item.id === editingId) ?? null, [items, editingId]);

  const load = async () => {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .or("is_library.eq.true,and(is_library.eq.false,user_id.is.null,source_user_id.is.null)")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message || "No se pudieron cargar las recetas oficiales");
      return [];
    }
    setItems((data ?? []) as RecipeRow[]);
    return (data ?? []) as RecipeRow[];
  };

  useEffect(() => { load(); }, []);

  const updateForm = (patch: Partial<LibForm>) => setForm(prev => ({ ...prev, ...patch }));
  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setMacroDebug([]);
    setLastMacroWarning("");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("recipe-images").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from("recipe-images").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("No se pudo preparar la imagen");
      updateForm({ image_url: signed.signedUrl });
      toast.success("Imagen subida");
    } catch (err: any) {
      toast.error(err.message || "Error al subir imagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const applyMacros = (data: any) => {
    console.info("[admin-recipes] macros calculados", {
      found: data?.found,
      notFound: data?.notFound,
      missingGrams: data?.missingGrams,
      warnings: data?.warnings,
      debug: data?.debug,
    });
    const macros = macrosFromSpecialist(data);
    updateForm({
      calories: numberText(macros.calories),
      protein: numberText(macros.protein),
      carbs: numberText(macros.carbs),
      fat: numberText(macros.fat),
      fiber: numberText(macros.fiber),
    });
    setMacroDebug(data.debug ?? []);
    const missing = missingIngredientNames(data);
    if (missing.length) {
      const message = `No se pudo calcular correctamente: ${missing.join(", ")}`;
      setLastMacroWarning(message);
      toast.warning(message);
    } else {
      setLastMacroWarning("");
      toast.success("Macros recalculados");
    }
    return macros;
  };

  const recalculateForForm = async () => {
    const ingredients = parseLines(form.ingredients);
    if (!ingredients.length) { toast.error("Añade ingredientes con cantidades antes de recalcular"); return null; }
    const missingQty = ingredients.filter(line => !QTY_RE.test(line));
    if (missingQty.length) toast.warning(`Hay ingredientes sin gramos o cantidad clara: ${missingQty[0]}`);
    setCalculating(true);
    try {
      console.info("[admin-recipes] recalculando macros del formulario", {
        ingredients,
        servings: Number(form.servings) || 1,
        category: form.category,
      });
      const data = await calculateWithMacroSpecialist({
        ingredientsText: form.ingredients,
        servings: Number(form.servings) || 1,
        category: form.category,
      });
      return applyMacros(data);
    } catch (err: any) {
      console.error("[admin-recipes] error recalculando macros del formulario", err);
      toast.error(err.message || "Error recalculando macros");
      return null;
    } finally {
      setCalculating(false);
    }
  };

  const payloadFromForm = (base?: RecipeRow, overrideMacros?: any) => {
    const macros = {
      ...(overrideMacros ?? macrosFromForm(form, base?.macros)),
    };
    if (form.prep_time.trim()) macros.prep_time = form.prep_time.trim();
    if (form.servings.trim()) macros.servings = form.servings.trim();
    const status = statusPayload(form.status);
    const prepTime = numberOrNull(form.prep_time);
    const servings = numberOrNull(form.servings);
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      categories: form.category ? [form.category] : [],
      tags: parseTags(form.tags),
      image_url: form.image_url || base?.image_url || null,
      video_url: form.video_url || null,
      ingredients: parseLines(form.ingredients),
      steps: parseLines(form.steps),
      prep_time: Number.isFinite(prepTime) ? prepTime : null,
      servings: Number.isFinite(servings) ? servings : null,
      macros,
      is_high_protein: Number(macros.protein || 0) >= 25,
      ...status,
    };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.title.trim()) { toast.error("El nombre de la receta es obligatorio"); return; }
    if (!form.category) { toast.error("La categoría es obligatoria"); return; }
    setSaving(true);
    try {
      const payload = payloadFromForm(editingRecipe);
      const result = editingId
        ? await supabase.from("recipes").update(payload).eq("id", editingId).select("*").maybeSingle()
        : await supabase.from("recipes").insert({ ...payload, user_id: null, source_user_id: null } as any).select("*").single();
      if (result.error) throw result.error;
      if (editingId && !result.data) throw new Error("No se encontró la receta para actualizar");
      resetForm();
      await load();
      toast.success(editingId ? "Receta oficial actualizada" : "Receta oficial creada");
    } catch (err: any) {
      toast.error(err.message || "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (recipe: RecipeRow) => {
    setEditingId(recipe.id);
    setForm(formFromRecipe(recipe));
    setMacroDebug([]);
    setLastMacroWarning("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const duplicateRecipe = async (recipe: RecipeRow) => {
    const copy = {
      title: `Copia de ${recipe.title}`,
      description: recipe.description,
      category: recipe.category,
      categories: recipe.categories ?? (recipe.category ? [recipe.category] : []),
      tags: recipe.tags ?? [],
      image_url: recipe.image_url,
      video_url: recipe.video_url,
      ingredients: recipe.ingredients ?? [],
      steps: recipe.steps ?? [],
      prep_time: recipe.prep_time ?? null,
      servings: recipe.servings ?? null,
      macros: recipe.macros ?? {},
      is_library: true,
      is_featured: false,
      visibility: "community",
      is_high_protein: Number(recipe.macros?.protein || 0) >= 25,
      user_id: null,
      source_user_id: null,
    };
    const { error } = await supabase.from("recipes").insert(copy as any);
    if (error) toast.error(error.message);
    else { toast.success("Receta duplicada"); load(); }
  };

  const deleteRecipe = async (recipe: RecipeRow) => {
    if (!confirm(CONFIRM_DELETE)) return;
    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
    if (error) { toast.error(error.message); return; }
    if (editingId === recipe.id) resetForm();
    await load();
    toast.success("Receta eliminada");
  };

  const recalculateRecipe = async (recipe: RecipeRow) => {
    const ingredientsText = ingredientsToText(recipe.ingredients);
    if (!ingredientsText.trim()) { toast.error("Esta receta no tiene ingredientes para recalcular"); return; }
    setCalculating(true);
    try {
      console.info("[admin-recipes] recalculando macros de receta", {
        recipeId: recipe.id,
        title: recipe.title,
        ingredientsText,
        servings: Number(recipe.servings ?? recipe.macros?.servings) || 1,
        category: recipe.category ?? "biblioteca",
      });
      const data = await calculateWithMacroSpecialist({
        ingredientsText,
        servings: Number(recipe.servings ?? recipe.macros?.servings) || 1,
        category: recipe.category ?? "biblioteca",
      });
      const macros = {
        ...(recipe.macros ?? {}),
        ...macrosFromSpecialist(data),
        prep_time: recipe.macros?.prep_time ?? recipe.prep_time ?? undefined,
        servings: recipe.macros?.servings ?? recipe.servings ?? undefined,
      };
      const { error } = await supabase.from("recipes").update({
        macros,
        is_high_protein: Number(macros.protein || 0) >= 25,
      }).eq("id", recipe.id);
      if (error) throw error;
      const missing = missingIngredientNames(data);
      if (missing.length) toast.warning(`Receta recalculada con avisos: ${missing.join(", ")}`);
      else toast.success("Receta recalculada");
      await load();
    } catch (err: any) {
      console.error("[admin-recipes] error recalculando receta", {
        recipeId: recipe.id,
        title: recipe.title,
        ingredientsText,
        error: err,
      });
      toast.error(err.message || "No se pudo recalcular la receta");
    } finally {
      setCalculating(false);
    }
  };

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter(item => {
      const matchesCategory = !filterCat || item.category === filterCat;
      const matchesSearch = !term || [item.title, item.description, item.category, ...(item.tags ?? [])]
        .filter(Boolean).join(" ").toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [items, filterCat, query]);

  return (
    <div className="pb-28">
      <AdminPageHeader title="Recetas oficiales" subtitle="Edita, duplica, recalcula y revisa las recetas visibles en la Biblioteca oficial." />

      <form onSubmit={submit} className="card-soft p-4 space-y-3 mb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-sm">{editingId ? "Editar receta oficial" : "Nueva receta oficial"}</div>
            <p className="text-xs muted mt-0.5">Guardar no recalcula macros automáticamente. Usa el botón “Recalcular macros” cuando quieras actualizar valores nutricionales.</p>
          </div>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs muted inline-flex items-center gap-1 shrink-0">
              <X className="h-3 w-3" /> Cancelar
            </button>
          )}
        </div>

        <input className="field" placeholder="Nombre de la receta *" value={form.title} onChange={e => updateForm({ title: e.target.value })} required />
        <select className="field" value={form.category} onChange={e => updateForm({ category: e.target.value })} required>
          {LIBRARY_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
        <textarea className="field min-h-20" placeholder="Descripción" value={form.description} onChange={e => updateForm({ description: e.target.value })} />

        <div className="space-y-2">
          {form.image_url && (
            <div className="relative rounded-xl overflow-hidden aspect-video bg-muted">
              <img src={form.image_url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => updateForm({ image_url: "" })} className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <label className="btn-ghost w-full cursor-pointer">
            <Upload className="h-4 w-4" />
            {uploading ? "Subiendo…" : (form.image_url ? "Cambiar imagen" : "Subir imagen")}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        <VideoField value={form.video_url} onChange={url => updateForm({ video_url: url })} label="Vídeo (opcional)" />

        <div className="grid grid-cols-2 gap-2">
          <input className="field" placeholder="Tiempo en minutos" value={form.prep_time} onChange={e => updateForm({ prep_time: e.target.value })} />
          <input className="field" placeholder="Raciones" value={form.servings} onChange={e => updateForm({ servings: e.target.value })} />
        </div>

        <select className="field" value={form.status} onChange={e => updateForm({ status: e.target.value as OfficialStatus })}>
          <option value="visible">Visible en Biblioteca</option>
          <option value="featured">Visible y destacada</option>
          <option value="hidden">Oculta para clientes</option>
        </select>

        <textarea
          className="field min-h-32"
          placeholder={'Ingredientes con gramos exactos, uno por línea\nEj: 100 g pollo\n50 g arroz cocido'}
          value={form.ingredients}
          onChange={e => { setMacroDebug([]); setLastMacroWarning(""); updateForm({ ingredients: e.target.value }); }}
        />
        <textarea className="field min-h-28" placeholder="Preparación paso a paso, un paso por línea" value={form.steps} onChange={e => updateForm({ steps: e.target.value })} />
        <input className="field" placeholder="Etiquetas separadas por coma" value={form.tags} onChange={e => updateForm({ tags: e.target.value })} />

        <div className="grid grid-cols-5 gap-2">
          <input className="field text-center" aria-label="Calorías" placeholder="Kcal" value={form.calories} onChange={e => updateForm({ calories: e.target.value })} />
          <input className="field text-center" aria-label="Proteínas" placeholder="Prot" value={form.protein} onChange={e => updateForm({ protein: e.target.value })} />
          <input className="field text-center" aria-label="Hidratos" placeholder="Hidr" value={form.carbs} onChange={e => updateForm({ carbs: e.target.value })} />
          <input className="field text-center" aria-label="Grasas" placeholder="Grasa" value={form.fat} onChange={e => updateForm({ fat: e.target.value })} />
          <input className="field text-center" aria-label="Fibra" placeholder="Fibra" value={form.fiber} onChange={e => updateForm({ fiber: e.target.value })} />
        </div>
        <MacroGrid values={form} />

        <button type="button" onClick={recalculateForForm} disabled={calculating || uploading || saving || !parseLines(form.ingredients).length} className="btn-ghost w-full">
          <Calculator className="h-4 w-4" /> {calculating ? "Recalculando…" : "Recalcular macros"}
        </button>
        {lastMacroWarning && <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 p-3 text-xs">{lastMacroWarning}</div>}

        {macroDebug.length > 0 && (
          <details className="card-soft p-3 text-xs space-y-2">
            <summary className="cursor-pointer font-semibold text-sm">Detalle del cálculo nutricional</summary>
            <div className="space-y-2 pt-2">
              {macroDebug.map((item, idx) => (
                <div key={`${item.raw}-${idx}`} className="rounded-xl border border-border/70 bg-white p-2">
                  <div className="font-medium text-foreground">{item.raw}</div>
                  <div className="muted">Interpretado como: {item.parsedName || "—"}</div>
                  <div className="muted">Cantidad: {item.grams ?? "—"} g/ml · Estado: {item.status} · Fuente: {item.source ?? "—"}</div>
                  <div className="muted">Coincidencia: {item.matchedAs ?? "No encontrada"}</div>
                </div>
              ))}
            </div>
          </details>
        )}

        <button className="btn-primary w-full" disabled={uploading || calculating || saving}>
          <Save className="h-4 w-4" /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear receta oficial"}
        </button>
      </form>

      <div className="card-soft p-3 mb-3 space-y-2">
        <input className="field" placeholder="Buscar receta oficial…" value={query} onChange={e => setQuery(e.target.value)} />
        <select className="field" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {LIBRARY_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {visible.map(recipe => {
          const status = recipeStatus(recipe);
          return (
            <div key={recipe.id} className="card-soft p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                {recipe.image_url && <img src={recipe.image_url} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate flex items-center gap-1">
                    {status === "featured" && <Star className="h-3 w-3 text-primary fill-primary" />}
                    {recipe.title}
                  </div>
                  <div className="text-xs muted truncate">
                    {getCategoryLabel(recipe.category)} · {recipe.macros?.protein ?? 0}g prot · {recipe.macros?.calories ?? 0} kcal · {status === "hidden" ? "Oculta" : status === "featured" ? "Destacada" : "Visible"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center text-[11px]">
                <MiniMacro label="Kcal" value={recipe.macros?.calories ?? 0} />
                <MiniMacro label="Prot" value={`${recipe.macros?.protein ?? 0}g`} />
                <MiniMacro label="Hidr" value={`${recipe.macros?.carbs ?? 0}g`} />
                <MiniMacro label="Grasa" value={`${recipe.macros?.fat ?? 0}g`} />
                <MiniMacro label="Fibra" value={`${recipe.macros?.fiber ?? 0}g`} />
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-[11px]">
                <Link to={`/app/biblioteca/${recipe.id}`} className="btn-ghost px-2 py-2"><Eye className="h-3.5 w-3.5" /> Ver</Link>
                <button type="button" onClick={() => startEdit(recipe)} className="btn-ghost px-2 py-2"><Sparkles className="h-3.5 w-3.5" /> Editar</button>
                <button type="button" onClick={() => duplicateRecipe(recipe)} className="btn-ghost px-2 py-2"><Copy className="h-3.5 w-3.5" /> Duplicar</button>
                <button type="button" onClick={() => recalculateRecipe(recipe)} disabled={calculating} className="btn-ghost px-2 py-2"><Calculator className="h-3.5 w-3.5" /> Macros</button>
                <button type="button" onClick={() => deleteRecipe(recipe)} className="btn-ghost px-2 py-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Eliminar</button>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && <div className="card-soft p-6 text-center muted">No hay recetas oficiales con este filtro.</div>}
      </div>
    </div>
  );
}

function MiniMacro({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-secondary px-1.5 py-2">
      <div className="font-semibold text-foreground">{value || "—"}</div>
      <div className="muted uppercase tracking-wide text-[9px] mt-0.5">{label}</div>
    </div>
  );
}
