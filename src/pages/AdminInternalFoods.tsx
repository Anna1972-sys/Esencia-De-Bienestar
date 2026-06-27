import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { Calculator, Edit3, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type InternalFood = {
  id: string;
  name: string;
  synonyms: string[];
  base_quantity: number;
  base_unit: "g" | "ml" | "serving";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  category: string;
  source: string;
  is_active: boolean;
};

type FormState = Omit<InternalFood, "id" | "synonyms"> & {
  synonyms: string;
};

const emptyForm: FormState = {
  name: "",
  synonyms: "",
  base_quantity: 100,
  base_unit: "g",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  category: "general",
  source: "Tabla interna",
  is_active: true,
};

const toNumber = (value: any) => Number(value) || 0;
const synonymsToText = (value: string[] | null | undefined) => (value ?? []).join(", ");
const textToSynonyms = (value: string) =>
  value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

export default function AdminInternalFoods() {
  const [foods, setFoods] = useState<InternalFood[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFoods = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("internal_foods")
      .select("*")
      .order("name", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFoods((data ?? []).map((item: any) => ({
      ...item,
      base_quantity: toNumber(item.base_quantity),
      calories: toNumber(item.calories),
      protein: toNumber(item.protein),
      carbs: toNumber(item.carbs),
      fat: toNumber(item.fat),
      fiber: toNumber(item.fiber),
      synonyms: item.synonyms ?? [],
    })));
  };

  useEffect(() => {
    loadFoods();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return foods;
    return foods.filter(food =>
      food.name.toLowerCase().includes(normalized) ||
      food.category.toLowerCase().includes(normalized) ||
      food.source.toLowerCase().includes(normalized) ||
      food.synonyms.some(alias => alias.toLowerCase().includes(normalized))
    );
  }, [foods, query]);

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const edit = (food: InternalFood) => {
    setEditingId(food.id);
    setForm({
      name: food.name,
      synonyms: synonymsToText(food.synonyms),
      base_quantity: food.base_quantity,
      base_unit: food.base_unit,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      category: food.category,
      source: food.source,
      is_active: food.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      synonyms: textToSynonyms(form.synonyms),
      base_quantity: Number(form.base_quantity) || 100,
      base_unit: form.base_unit,
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
      fiber: Number(form.fiber) || 0,
      category: form.category.trim() || "general",
      source: form.source.trim() || "Tabla interna",
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    const request = editingId
      ? (supabase as any).from("internal_foods").update(payload).eq("id", editingId)
      : (supabase as any).from("internal_foods").insert(payload);

    const { error } = await request;
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? "Alimento actualizado" : "Alimento creado");
    reset();
    loadFoods();
  };

  const remove = async (food: InternalFood) => {
    if (!confirm(`¿Eliminar "${food.name}" de Alimentos internos?`)) return;
    const { error } = await (supabase as any).from("internal_foods").delete().eq("id", food.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Alimento eliminado");
      loadFoods();
    }
  };

  const updateForm = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  return (
    <div className="pb-28 max-w-3xl mx-auto">
      <AdminPageHeader
        title="Alimentos internos"
        subtitle="Base editable que el cálculo nutricional consulta antes de USDA y FatSecret."
      />

      <form onSubmit={save} className="card-soft p-4 space-y-4 mb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg">{editingId ? "Editar alimento" : "Nuevo alimento"}</h2>
            <p className="text-xs muted">Los valores deben corresponder a la cantidad base indicada.</p>
          </div>
          {editingId && (
            <button type="button" onClick={reset} className="btn-ghost">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs muted">Nombre</span>
            <input className="field" value={form.name} onChange={e => updateForm({ name: e.target.value })} required />
          </label>
          <label className="space-y-1">
            <span className="text-xs muted">Categoría</span>
            <input className="field" value={form.category} onChange={e => updateForm({ category: e.target.value })} />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-xs muted">Sinónimos separados por comas</span>
          <input className="field" placeholder="Ej. aove, aceite, olive oil" value={form.synonyms} onChange={e => updateForm({ synonyms: e.target.value })} />
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-xs muted">Cantidad base</span>
            <input className="field" type="number" min="0" step="0.1" value={form.base_quantity} onChange={e => updateForm({ base_quantity: Number(e.target.value) })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs muted">Unidad base</span>
            <select className="field" value={form.base_unit} onChange={e => updateForm({ base_unit: e.target.value as FormState["base_unit"] })}>
              <option value="g">100 g / gramos</option>
              <option value="ml">100 ml / mililitros</option>
              <option value="serving">1 ración</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs muted">Fuente</span>
            <input className="field" value={form.source} onChange={e => updateForm({ source: e.target.value })} />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {([
            ["calories", "Calorías"],
            ["protein", "Proteínas"],
            ["carbs", "Hidratos"],
            ["fat", "Grasas"],
            ["fiber", "Fibra"],
          ] as const).map(([key, label]) => (
            <label key={key} className="space-y-1">
              <span className="text-xs muted">{label}</span>
              <input className="field" type="number" step="0.1" value={form[key]} onChange={e => updateForm({ [key]: Number(e.target.value) } as Partial<FormState>)} />
            </label>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={e => updateForm({ is_active: e.target.checked })} />
          Activo para el cálculo nutricional
        </label>

        <button className="btn-primary w-full" disabled={saving}>
          {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear alimento"}
        </button>
      </form>

      <section className="card-soft p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 muted" />
          <input className="field" placeholder="Buscar alimento, categoría, fuente o sinónimo…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <div className="flex items-center justify-between text-xs muted mb-3">
          <span>{loading ? "Cargando…" : `${filtered.length} de ${foods.length} alimentos`}</span>
          <span>Prioridad: internos → USDA → FatSecret</span>
        </div>

        <div className="space-y-2">
          {filtered.map(food => (
            <div key={food.id} className={`rounded-2xl border p-3 bg-white ${food.is_active ? "border-border" : "border-dashed opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    <h3 className="font-medium truncate">{food.name}</h3>
                    {!food.is_active && <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted">Inactivo</span>}
                  </div>
                  <p className="text-xs muted mt-1">
                    {food.category} · Base: {food.base_quantity} {food.base_unit === "serving" ? "ración" : food.base_unit} · Fuente: {food.source}
                  </p>
                  {food.synonyms.length > 0 && <p className="text-xs muted mt-1">Sinónimos: {food.synonyms.join(", ")}</p>}
                  <div className="grid grid-cols-5 gap-1 text-center text-[11px] mt-2">
                    <span className="rounded-lg bg-secondary p-1">{food.calories} kcal</span>
                    <span className="rounded-lg bg-secondary p-1">{food.protein}g prot</span>
                    <span className="rounded-lg bg-secondary p-1">{food.carbs}g hidr</span>
                    <span className="rounded-lg bg-secondary p-1">{food.fat}g grasa</span>
                    <span className="rounded-lg bg-secondary p-1">{food.fiber}g fibra</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button type="button" onClick={() => edit(food)} className="btn-ghost text-xs">
                    <Edit3 className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button type="button" onClick={() => remove(food)} className="btn-ghost text-xs text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && <p className="text-sm muted text-center py-6">No hay alimentos que coincidan con la búsqueda.</p>}
        </div>
      </section>
    </div>
  );
}
