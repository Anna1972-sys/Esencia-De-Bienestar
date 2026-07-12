import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Eye, Star, Trash2, Upload, X, Save } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";
import { LIBRARY_CATEGORIES } from "@/lib/libraryCategories";
import { calculateWithMacroSpecialist, macrosFromSpecialist } from "@/lib/macroSpecialistClient";

type Visibility = "private" | "community" | "featured";

type Recipe = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  ingredients: any;
  steps: any;
  macros: any;
  servings?: number | string | null;
  category: string | null;
  categories: string[] | null;
  visibility: Visibility;
  is_library: boolean;
  is_featured: boolean;
  created_at: string;
};

const ingredientsToText = (ing: any) =>
  Array.isArray(ing)
    ? ing.map((i: any) => typeof i === "string" ? i : `${i.quantity ?? ""} ${i.name ?? ""}`.trim()).join("\n")
    : "";

const stepsToText = (steps: any) =>
  Array.isArray(steps) ? steps.map((s: any) => typeof s === "string" ? s : s?.text ?? "").join("\n") : "";

const getMacro = (recipe: Recipe, key: string) => Number(recipe.macros?.[key] ?? 0);
const nutritionLabel = (recipe: Recipe) =>
  recipe.macros?.nutrition_status === "verified" ? "Valores nutricionales verificados" : "Valores nutricionales estimados";
const GENERATED_CATEGORY_LABEL: Record<string, string> = {
  comidas_saludables: "Comidas saludables",
  almuerzos: "Almuerzos",
  meriendas: "Meriendas",
  nutricion_deportiva: "Nutrición deportiva",
};
const DEFAULT_LIBRARY_CATEGORY: Record<string, string> = {
  comidas_saludables: "comidas",
  almuerzos: "snacks",
  meriendas: "meriendas",
  nutricion_deportiva: "comidas",
};
const displayCategory = (category?: string | null) =>
  category ? GENERATED_CATEGORY_LABEL[category] ?? LIBRARY_CATEGORIES.find(c => c.id === category)?.label ?? category : "Sin categoría";

const parseEditableIngredients = (text: string) =>
  text.split("\n").map(s => s.trim()).filter(Boolean);

const calculateRecipeMacros = async (ingredientsText: string, servings: number, category?: string | null, fallbackMacros: any = {}) => {
  const ingredients = parseEditableIngredients(ingredientsText);
  if (!ingredients.length) return fallbackMacros ?? {};
  const data = await calculateWithMacroSpecialist({
    ingredientsText,
    servings: Number(servings) || 1,
    category: category || "biblioteca",
  });
  return {
    ...(fallbackMacros ?? {}),
    ...macrosFromSpecialist(data),
  };
};

export default function AdminUserRecipes() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [filterUser, setFilterUser] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: recs } = await supabase.from("recipes").select("*").eq("is_library", false).order("created_at", { ascending: false });
    const list = (recs ?? []) as Recipe[];
    setRecipes(list);
    const ids = Array.from(new Set(list.map(r => r.user_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.display_name || "Sin nombre"; });
      setProfiles(map);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    return recipes.filter(r =>
      (!filterUser || r.user_id === filterUser) &&
      (!search || String(r.title ?? "").toLowerCase().includes(String(search ?? "").toLowerCase()))
    );
  }, [recipes, filterUser, search]);

  const userOptions = useMemo(() => Object.entries(profiles), [profiles]);

  const del = async (r: Recipe) => {
    if (!confirm("¿Eliminar esta receta?")) return;
    const { error } = await supabase.from("recipes").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminada"); load(); }
  };

  const publishToLibrary = async (r: Recipe, payload: Partial<Recipe>) => {
    if (!user) return;
    setBusy(true);
    const ingredientsText = String((payload as any).ingredientsText ?? ingredientsToText(r.ingredients));
    const stepsText = String((payload as any).stepsText ?? stepsToText(r.steps));
    const ingredients = ingredientsText
      .split("\n").map(s => s.trim()).filter(Boolean);
    const steps = stepsText
      .split("\n").map(s => s.trim()).filter(Boolean);
    let macros: any = r.macros ?? {};
    try {
      const servings = Number(r.servings ?? macros?.servings) || 1;
      macros = await calculateRecipeMacros(ingredientsText, servings, payload.category ?? r.category, macros);
      macros.servings = macros.servings ?? servings;
    } catch (err: any) {
      macros = {
        ...(macros ?? {}),
        nutrition_status: macros?.nutrition_status ?? "pending_review",
        nutrition_note: macros?.nutrition_note ?? "pendiente de revisión",
      };
      toast.warning(err.message || "No se pudieron recalcular los macros. Se conserva la receta con revisión pendiente.");
    }
    const insert = {
      user_id: user.id,
      source_user_id: r.user_id,
      title: payload.title ?? r.title,
      description: payload.description ?? r.description,
      image_url: payload.image_url ?? r.image_url,
      macros,
      servings: r.servings ?? macros.servings ?? null,
      ingredients: ingredients.length ? ingredients : r.ingredients,
      steps: steps.length ? steps : r.steps,
      category: payload.category ?? r.category,
      categories: payload.categories ?? r.categories ?? [],
      is_library: true,
      is_featured: true,
      visibility: "featured" as Visibility,
      is_high_protein: Number(macros?.protein || 0) >= 25,
    };
    const { error } = await supabase.from("recipes").insert(insert as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Publicada en la biblioteca");
    setEditing(null);
    load();
  };

  const saveInline = async (r: Recipe, payload: Partial<Recipe> & { ingredientsText?: string; stepsText?: string }) => {
    setBusy(true);
    const ingredients = payload.ingredientsText !== undefined
      ? payload.ingredientsText.split("\n").map(s => s.trim()).filter(Boolean)
      : r.ingredients;
    const steps = payload.stepsText !== undefined
      ? payload.stepsText.split("\n").map(s => s.trim()).filter(Boolean)
      : r.steps;
    const ingredientsText = payload.ingredientsText ?? ingredientsToText(r.ingredients);
    let macros: any = r.macros ?? {};
    try {
      const servings = Number(r.servings ?? macros?.servings) || 1;
      macros = await calculateRecipeMacros(ingredientsText, servings, payload.category ?? r.category, macros);
      macros.servings = macros.servings ?? servings;
    } catch (err: any) {
      macros = {
        ...(macros ?? {}),
        nutrition_status: macros?.nutrition_status ?? "pending_review",
        nutrition_note: macros?.nutrition_note ?? "pendiente de revisión",
      };
      toast.warning(err.message || "No se pudieron recalcular los macros. Se conserva la receta con revisión pendiente.");
    }
    const { error } = await supabase.from("recipes").update({
      title: payload.title ?? r.title,
      description: payload.description ?? r.description,
      image_url: payload.image_url ?? r.image_url,
      macros,
      ingredients,
      steps,
      category: payload.category ?? r.category,
      categories: payload.categories ?? r.categories ?? [],
      visibility: "private" as Visibility,
    } as any).eq("id", r.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cambios guardados");
    setEditing(null);
    load();
  };

  return (
    <div className="admin-user-recipes-page pb-28">
      <AdminPageHeader title="Recetas generadas por usuarios" subtitle="Revisa las recetas creadas con IA y publícalas manualmente si encajan en la Biblioteca oficial." />


      <div className="card-soft p-3 mb-4 space-y-2">
        <input className="field" placeholder="Buscar por título…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="field admin-user-filter-select" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {userOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {visible.map(r => (
          <div key={r.id} className="card-soft p-3">
            <div className="flex items-center gap-3">
              {r.image_url
                ? <img src={r.image_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                : <div className="h-12 w-12 rounded-lg bg-secondary shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{r.title}</div>
                <div className="text-xs muted truncate">
                  {profiles[r.user_id || ""] || "Anónima"} · {new Date(r.created_at).toLocaleDateString()}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary">Pendiente de revisión</span>
                  {r.category && <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">{displayCategory(r.category)}</span>}
                  <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary">{nutritionLabel(r)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditing(r)} className="p-2 text-primary" aria-label="Ver/editar"><Eye className="h-4 w-4" /></button>
                <button onClick={() => del(r)} className="p-2 text-destructive" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5 mt-3 text-center text-[11px]">
              <MiniMacro label="Kcal" value={getMacro(r, "calories")} />
              <MiniMacro label="Prot" value={`${getMacro(r, "protein")}g`} />
              <MiniMacro label="Hidr" value={`${getMacro(r, "carbs")}g`} />
              <MiniMacro label="Grasa" value={`${getMacro(r, "fat")}g`} />
              <MiniMacro label="Fibra" value={`${getMacro(r, "fiber")}g`} />
            </div>
          </div>
        ))}
        {visible.length === 0 && <div className="card-soft p-6 text-center muted">No hay recetas.</div>}
      </div>

      {editing && (
        <EditorModal
          recipe={editing}
          onClose={() => setEditing(null)}
          onSave={(p) => saveInline(editing, p)}
          onPublish={(p) => publishToLibrary(editing, p)}
          busy={busy}
        />
      )}
    </div>
  );
}

function EditorModal({ recipe, onClose, onSave, onPublish, busy }: {
  recipe: Recipe;
  onClose: () => void;
  onSave: (p: any) => void;
  onPublish: (p: any) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(recipe.title);
  const [description, setDescription] = useState(recipe.description ?? "");
  const [ingredientsText, setIngredientsText] = useState(ingredientsToText(recipe.ingredients));
  const [stepsText, setStepsText] = useState(stepsToText(recipe.steps));
  const initialLibraryCategory = LIBRARY_CATEGORIES.some(c => c.id === recipe.category)
    ? recipe.category ?? LIBRARY_CATEGORIES[0].id
    : DEFAULT_LIBRARY_CATEGORY[recipe.category ?? ""] ?? LIBRARY_CATEGORIES[0].id;
  const [category, setCategory] = useState(initialLibraryCategory);
  const [categories, setCategories] = useState<string[]>(recipe.categories ?? []);
  const [imageUrl, setImageUrl] = useState(recipe.image_url ?? "");
  const [uploading, setUploading] = useState(false);

  const toggleCat = (id: string) =>
    setCategories(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("recipe-images").upload(path, file);
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("recipe-images").createSignedUrl(path, 60 * 60 * 24 * 7);
      setImageUrl(signed?.signedUrl ?? "");
      toast.success("Imagen subida");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const payload = { title, description, ingredientsText, stepsText, category, categories, image_url: imageUrl };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-end sm:place-items-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between">
          <div className="font-medium">Editar receta</div>
          <button onClick={onClose} className="p-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {imageUrl && (
            <div className="relative rounded-xl overflow-hidden aspect-video bg-muted">
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-white/90 rounded-full p-1"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <label className="btn-ghost w-full cursor-pointer">
            <Upload className="h-4 w-4" /> {uploading ? "Subiendo…" : (imageUrl ? "Cambiar imagen" : "Subir imagen")}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>

          <div>
            <label className="text-xs muted">Título</label>
            <input className="field" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs muted">Descripción</label>
            <input className="field" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-xs muted">Categoría generada</label>
            <div className="field bg-secondary/60">{displayCategory(recipe.category)}</div>
          </div>
          <div>
            <label className="text-xs muted">Categoría para Biblioteca oficial</label>
            <select className="field" value={category} onChange={e => setCategory(e.target.value)}>
              {LIBRARY_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs muted">Etiquetas adicionales</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {LIBRARY_CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  className={`text-xs px-2 py-1 rounded-full border ${categories.includes(c.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="card-soft p-3">
            <div className="text-xs font-semibold mb-2">Datos nutricionales</div>
            <div className="grid grid-cols-5 gap-1.5 text-center text-[11px]">
              <MiniMacro label="Kcal" value={getMacro(recipe, "calories")} />
              <MiniMacro label="Prot" value={`${getMacro(recipe, "protein")}g`} />
              <MiniMacro label="Hidr" value={`${getMacro(recipe, "carbs")}g`} />
              <MiniMacro label="Grasa" value={`${getMacro(recipe, "fat")}g`} />
              <MiniMacro label="Fibra" value={`${getMacro(recipe, "fiber")}g`} />
            </div>
            <div className="text-[11px] muted mt-2">{nutritionLabel(recipe)}</div>
          </div>
          <div>
            <label className="text-xs muted">Ingredientes (uno por línea)</label>
            <textarea className="field min-h-28" value={ingredientsText} onChange={e => setIngredientsText(e.target.value)} />
          </div>
          <div>
            <label className="text-xs muted">Preparación (un paso por línea)</label>
            <textarea className="field min-h-28" value={stepsText} onChange={e => setStepsText(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => onSave(payload)} disabled={busy} className="btn-secondary flex-1">
              <Save className="h-4 w-4" /> Guardar cambios
            </button>
            <button onClick={() => onPublish(payload)} disabled={busy} className="btn-primary flex-1">
              <Star className="h-4 w-4" /> Añadir a Biblioteca oficial
            </button>
          </div>
        </div>
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
