import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Pencil, X, Upload, Star, Sparkles } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";
import { LIBRARY_CATEGORIES, getCategoryLabel } from "@/lib/libraryCategories";
import { useFormDraft } from "@/hooks/useFormDraft";
import DraftBanner from "@/components/DraftBanner";
import VideoField from "@/components/VideoField";
import { calculateWithMacroSpecialist, macrosFromSpecialist } from "@/lib/macroSpecialistClient";

const CONFIRM_DELETE = "¿Estás segura de que deseas eliminar este elemento? Esta acción no se puede deshacer.";

type LibForm = {
  title: string; description: string; category: string;
  protein: number; carbs: number; fat: number; calories: number; fiber: number;
  prep_time: string; servings: string;
  ingredients: string; steps: string;
  image_url: string; video_url: string; is_featured: boolean;
};

const emptyForm: LibForm = {
  title: "", description: "", category: LIBRARY_CATEGORIES[0].id,
  protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0, prep_time: "", servings: "",
  ingredients: "", steps: "",
  image_url: "", video_url: "", is_featured: false,
};

const QTY_RE = /\d/;
const parseIngredients = (text: string) =>
  text.split("\n").map(s => s.trim()).filter(Boolean);

export default function AdminRecipes() {
  const [items, setItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { value: f, setValue: setF, clearDraft, hasDraft } = useFormDraft<LibForm>("admin-recipes-new", emptyForm, !editingId);
  const [filterCat, setFilterCat] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [macroDebug, setMacroDebug] = useState<any[]>([]);

  const load = async () => {
    const { data, error } = await supabase.from("recipes").select("*").eq("is_library", true).order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message || "No se pudieron cargar las recetas");
      return [];
    }
    setItems(data ?? []);
    return data ?? [];
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => { setF(emptyForm); setEditingId(null); setMacroDebug([]); clearDraft(); };

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
      const url = signed?.signedUrl ?? "";
      setF(prev => ({ ...prev, image_url: url }));
      toast.success("Imagen subida");
    } catch (err: any) {
      toast.error(err.message || "Error al subir imagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const calculateMacros = async () => {
    const ingredients = parseIngredients(f.ingredients);
    if (ingredients.length === 0) { toast.error("Añade al menos un ingrediente"); return null; }
    const missingQty = ingredients.filter(i => !QTY_RE.test(i));
    if (missingQty.length > 0) toast.warning(`Hay ingredientes sin cantidad. Se guardarán con revisión pendiente: ${missingQty[0]}`);
    setCalculating(true);
    try {
      const data = await calculateWithMacroSpecialist({
        ingredientsText: f.ingredients,
        servings: Number(f.servings) || 1,
        category: f.category,
      });
      setMacroDebug(data.debug ?? []);
      console.info("[AdminRecipes] Depuración cálculo macros", JSON.stringify(data.debug ?? data.found, null, 2));
      const macros = macrosFromSpecialist(data);
      setF(prev => ({
        ...prev,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
      }));
      if (data.notFound?.length || data.missingGrams?.length) toast.warning("Macros calculados con avisos pendientes de revisión");
      else toast.success("Macros calculados");
      return macros;
    } catch (err: any) {
      toast.error(err.message || "Error calculando macros");
      return null;
    } finally {
      setCalculating(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!f.title.trim()) { toast.error("El título es obligatorio"); return; }
    if (!f.category) { toast.error("La categoría es obligatoria"); return; }
    setSaving(true);
    const ingredients = parseIngredients(f.ingredients);
    try {
      if (ingredients.length > 0) {
        const missingQty = ingredients.filter(i => !QTY_RE.test(i));
        if (missingQty.length > 0) {
          toast.warning(`Hay ingredientes sin cantidad. Se guardarán con revisión pendiente: ${missingQty[0]}`);
        }
      }
      let calculatedMacros: any = null;
      if (ingredients.length > 0) {
        setCalculating(true);
        try {
          const data = await calculateWithMacroSpecialist({
            ingredientsText: f.ingredients,
            servings: Number(f.servings) || 1,
            category: f.category,
          });
          setMacroDebug(data.debug ?? []);
          console.info("[AdminRecipes] Depuración cálculo macros antes de guardar", JSON.stringify(data.debug ?? data.found, null, 2));
          calculatedMacros = macrosFromSpecialist(data);
          if (data.notFound?.length || data.missingGrams?.length) {
            toast.warning("Receta guardada con macros pendientes de revisión para algunos ingredientes");
          }
        } catch (err: any) {
          toast.warning(err.message || "No se pudieron calcular los macros. La receta se guardará con revisión pendiente.");
        } finally {
          setCalculating(false);
        }
      }
      const macros: any = calculatedMacros ?? {
        protein: f.protein || 0,
        carbs: f.carbs || 0,
        fat: f.fat || 0,
        calories: f.calories || 0,
        fiber: f.fiber || 0,
        nutrition_status: "pending_review",
        nutrition_note: "pendiente de revisión",
      };
      if (f.prep_time.trim()) macros.prep_time = f.prep_time.trim();
      if (f.servings.trim()) macros.servings = f.servings.trim();

      const prepTime = f.prep_time.trim() ? Number.parseInt(f.prep_time, 10) : null;
      const servings = f.servings.trim() ? Number.parseInt(f.servings, 10) : null;

      const payload = {
        title: f.title.trim(),
        description: f.description.trim() || null,
        category: f.category,
        is_library: true,
        is_featured: f.is_featured,
        image_url: f.image_url || null,
        video_url: f.video_url || null,
        is_high_protein: Number(macros.protein || 0) >= 25,
        macros,
        ingredients,
        steps: f.steps.split("\n").map(s => s.trim()).filter(Boolean),
        prep_time: Number.isFinite(prepTime) ? prepTime : null,
        servings: Number.isFinite(servings) ? servings : null,
      };

      const result = editingId
        ? await supabase.from("recipes").update(payload).eq("id", editingId).select("*").maybeSingle()
        : await supabase.from("recipes").insert(payload).select("*").single();

      if (result.error) throw result.error;
      if (editingId && !result.data) throw new Error("No se encontró la receta para actualizar. Vuelve a abrirla e inténtalo de nuevo.");

      resetForm();
      await load();
      toast.success(editingId ? "Receta actualizada" : "Receta añadida");
    } catch (err: any) {
      toast.error(err.message || "No se pudieron guardar los cambios");
    } finally {
      setCalculating(false);
      setSaving(false);
    }
  };

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setMacroDebug([]);
    const ing = Array.isArray(r.ingredients) ? r.ingredients : [];
    const steps = Array.isArray(r.steps) ? r.steps : [];
    setF({
      title: r.title ?? "",
      description: r.description ?? "",
      category: r.category ?? LIBRARY_CATEGORIES[0].id,
      protein: Number(r.macros?.protein) || 0,
      carbs: Number(r.macros?.carbs) || 0,
      fat: Number(r.macros?.fat) || 0,
      calories: Number(r.macros?.calories) || 0,
      fiber: Number(r.macros?.fiber) || 0,
      prep_time: r.macros?.prep_time ?? "",
      servings: r.macros?.servings ?? "",
      ingredients: ing.map((i: any) => typeof i === "string" ? i : `${i.name}${i.quantity ? ` — ${i.quantity}` : ""}`).join("\n"),
      steps: steps.map((s: any) => typeof s === "string" ? s : s?.text ?? "").join("\n"),
      image_url: r.image_url ?? "",
      video_url: r.video_url ?? "",
      is_featured: !!r.is_featured,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  const del = async (id: string) => {
    if (!confirm(CONFIRM_DELETE)) return;
    await supabase.from("recipes").delete().eq("id", id);
    if (editingId === id) resetForm();
    load();
  };

  const visible = filterCat ? items.filter(i => i.category === filterCat) : items;

  return (
    <div className="pb-28">
      <AdminPageHeader title="Recetas" subtitle="Crear, editar y eliminar recetas" />


      {!editingId && hasDraft && <DraftBanner onDiscard={() => { clearDraft(); setF(emptyForm); }} />}
      <form onSubmit={submit} className="card-soft p-4 space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm">{editingId ? "Editar receta" : "Nueva receta"}</div>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs muted inline-flex items-center gap-1">
              <X className="h-3 w-3" /> Cancelar
            </button>
          )}
        </div>
        <input className="field" placeholder="Título *" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} required />
        <select className="field" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} required>
          {LIBRARY_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <p className="text-xs muted -mt-1">Solo el título y la categoría son obligatorios. El resto es opcional.</p>

        <input className="field" placeholder="Descripción (opcional)" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />

        <div className="space-y-2">
          {f.image_url && (
            <div className="relative rounded-xl overflow-hidden aspect-video bg-muted">
              <img src={f.image_url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setF({ ...f, image_url: "" })}
                className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <label className="btn-ghost w-full cursor-pointer">
            <Upload className="h-4 w-4" />
            {uploading ? "Subiendo…" : (f.image_url ? "Cambiar imagen" : "Subir imagen (opcional)")}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        <VideoField value={f.video_url} onChange={url => setF(prev => ({ ...prev, video_url: url }))} label="Vídeo (opcional)" />

        <label className="flex items-center gap-2 text-sm py-1">
          <input type="checkbox" checked={f.is_featured} onChange={e => setF({ ...f, is_featured: e.target.checked })} />
          <Star className="h-4 w-4 text-primary" /> Marcar como destacada
        </label>

        <div className="grid grid-cols-2 gap-2">
          <input className="field" placeholder="Tiempo (opcional)" value={f.prep_time} onChange={e => setF({ ...f, prep_time: e.target.value })} />
          <input className="field" placeholder="Porciones (opcional)" value={f.servings} onChange={e => setF({ ...f, servings: e.target.value })} />
        </div>

        <textarea
          className="field min-h-28"
          placeholder={'Ingredientes (opcional, uno por línea con cantidad)\nEj: 100 g de pollo\n2 huevos'}
          value={f.ingredients}
          onChange={e => { setMacroDebug([]); setF({ ...f, ingredients: e.target.value, protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 }); }}
        />
        <textarea className="field min-h-24" placeholder="Preparación paso a paso (opcional, uno por línea)" value={f.steps} onChange={e => setF({ ...f, steps: e.target.value })} />

        <button type="button" onClick={calculateMacros} disabled={calculating || uploading || saving || !parseIngredients(f.ingredients).length} className="btn-ghost w-full">
          <Sparkles className="h-4 w-4" /> {calculating ? "Calculando macros…" : "Calcular macros"}
        </button>

        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          <div className="card-soft p-2"><div className="font-semibold">{f.calories}</div><div className="muted">kcal</div></div>
          <div className="card-soft p-2"><div className="font-semibold">{f.protein}g</div><div className="muted">Prot</div></div>
          <div className="card-soft p-2"><div className="font-semibold">{f.carbs}g</div><div className="muted">Carb</div></div>
          <div className="card-soft p-2"><div className="font-semibold">{f.fat}g</div><div className="muted">Grasa</div></div>
          <div className="card-soft p-2"><div className="font-semibold">{f.fiber}g</div><div className="muted">Fibra</div></div>
        </div>

        {macroDebug.length > 0 && (
          <details className="card-soft p-3 text-xs space-y-2">
            <summary className="cursor-pointer font-semibold text-sm">Depuración del cálculo nutricional</summary>
            <div className="space-y-2 pt-2">
              {macroDebug.map((item, idx) => (
                <div key={`${item.raw}-${idx}`} className="rounded-xl border border-border/70 bg-white p-2">
                  <div className="font-medium text-foreground">{item.raw}</div>
                  <div className="muted">Interpretado como: {item.parsedName || "—"} · {item.grams ?? "—"} g</div>
                  <div className="muted">Estado: {item.status} · Fuente: {item.source ?? "—"}</div>
                  <div className="muted">Coincidencia: {item.matchedAs ?? "No encontrada"}</div>
                  {item.macros && (
                    <div className="mt-1 grid grid-cols-5 gap-1 text-center">
                      <span>{item.macros.kcal ?? 0} kcal</span>
                      <span>{item.macros.protein ?? 0}g prot</span>
                      <span>{item.macros.carbs ?? 0}g hidr</span>
                      <span>{item.macros.fat ?? 0}g grasa</span>
                      <span>{item.macros.fiber ?? 0}g fibra</span>
                    </div>
                  )}
                  {Array.isArray(item.attempts) && item.attempts.length > 0 && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted/40 p-2 text-[10px] whitespace-pre-wrap">
                      {JSON.stringify(item.attempts, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        <button className="btn-primary w-full" disabled={uploading || calculating || saving}>
          <Plus className="h-4 w-4" /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Añadir receta"}
        </button>
      </form>


      <select className="field mb-3" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
        <option value="">Todas las categorías</option>
        {LIBRARY_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      <div className="space-y-2">{visible.map(i => (
        <div key={i.id} className="card-soft p-3 flex items-center justify-between gap-2">
          {i.image_url && <img src={i.image_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate flex items-center gap-1">
              {i.is_featured && <Star className="h-3 w-3 text-primary fill-primary" />}
              {i.title}
            </div>
            <div className="text-xs muted truncate">{getCategoryLabel(i.category)} · {i.macros?.protein ?? 0}g prot · {i.macros?.calories ?? 0} kcal</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => startEdit(i)} className="text-primary" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => del(i.id)} className="text-destructive" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      ))}</div>
    </div>
  );
}
