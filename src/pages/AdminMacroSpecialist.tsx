import { useEffect, useMemo, useState } from "react";
import { Calculator, Edit3, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";
import { calculateWithMacroSpecialist } from "@/lib/macroSpecialistClient";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const EXAMPLE = "pollo 200 g\narroz 120 g\ncalabacín 150 g\ntomate 100 g\naceite de oliva 10 g";
const emptyManualFoodForm = {
  nombre: "",
  aliases: "",
  categoria: "general",
  estado: "natural",
  kcal_100g: "",
  proteina_100g: "",
  hidratos_100g: "",
  grasa_100g: "",
  fibra_100g: "",
  azucares_100g: "",
  sal_100g: "",
  is_active: true,
};

type ManualFoodForm = typeof emptyManualFoodForm;

type ManualFoodItem = {
  id: string;
  nombre: string;
  aliases: string[];
  categoria: string;
  estado: "crudo" | "cocido" | "natural" | "procesado";
  kcal_100g: number | null;
  proteina_100g: number | null;
  hidratos_100g: number | null;
  grasa_100g: number | null;
  fibra_100g: number | null;
  azucares_100g: number | null;
  sal_100g: number | null;
  is_active: boolean;
};

const getSessionHeaders = async (refresh = false) => {
  if (refresh) await supabase.auth.refreshSession().catch(() => null);
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
};

const fetchManualFoodsApi = async (init: RequestInit = {}) => {
  const buildRequest = async (refresh = false) => fetch("/api/manual-food-items", {
    ...init,
    headers: {
      ...((init.headers as Record<string, string> | undefined) ?? {}),
      ...(await getSessionHeaders(refresh)),
    },
  });

  let response = await buildRequest(false);
  if (response.status === 401) response = await buildRequest(true);
  return response;
};

const readApiPayload = async (response: Response) => {
  const rawText = await response.text().catch(() => "");
  try {
    return rawText ? JSON.parse(rawText) : null;
  } catch {
    return {
      error: `La API de alimentos manuales no devolvió JSON válido (${response.status}).`,
      detail: rawText.slice(0, 500),
    };
  }
};

const apiErrorMessage = (payload: any, fallback: string) =>
  [
    payload?.error,
    payload?.detail,
    payload?.hint ? `Pista: ${payload.hint}` : "",
    payload?.code ? `Código: ${payload.code}` : "",
  ].filter(Boolean).join(" · ") || fallback;

const safeLowerCase = (value: unknown, functionName: string) => {
  console.info("[admin-macro-specialist] toLowerCase guard", {
    file: "src/pages/AdminMacroSpecialist.tsx",
    functionName,
    value,
    valueType: typeof value,
    wasNullish: value === null || value === undefined,
  });
  return String(value ?? "").toLowerCase();
};

const normalizeText = (value: unknown) =>
  safeLowerCase(value, "normalizeText")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const splitAliases = (value: string) =>
  value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

const numberOrNull = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const numberText = (value: number | null | undefined) => value === null || value === undefined ? "" : String(value);

export default function AdminMacroSpecialist() {
  const { isAdmin } = useAuth();
  const [ingredientsText, setIngredientsText] = useState(EXAMPLE);
  const [servings, setServings] = useState("1");
  const [category, setCategory] = useState("comidas_saludables");
  const [containsHerbalife, setContainsHerbalife] = useState(false);
  const [preferences, setPreferences] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showManualManager, setShowManualManager] = useState(false);
  const [showManualFood, setShowManualFood] = useState(false);
  const [manualFoods, setManualFoods] = useState<ManualFoodItem[]>([]);
  const [manualQuery, setManualQuery] = useState("");
  const [manualForm, setManualForm] = useState<ManualFoodForm>(emptyManualFoodForm);
  const [editingManualId, setEditingManualId] = useState<string | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

  const loadManualFoods = async () => {
    if (!isAdmin) return;
    setManualLoading(true);
    const response = await fetchManualFoodsApi();
    const payload = await readApiPayload(response);
    setManualLoading(false);
    if (!response.ok) {
      toast.error(apiErrorMessage(payload, "No se pudieron cargar los alimentos manuales"));
      return;
    }
    setManualFoods(payload?.data ?? []);
  };

  useEffect(() => {
    if (showManualManager) loadManualFoods();
  }, [isAdmin, showManualManager]);

  const filteredManualFoods = useMemo(() => {
    const normalized = normalizeText(manualQuery.trim());
    if (!normalized) return manualFoods;
    return manualFoods.filter(food =>
      normalizeText([
        food.nombre,
        food.categoria,
        food.estado,
        ...(food.aliases ?? []),
      ].join(" ")).includes(normalized)
    );
  }, [manualFoods, manualQuery]);

  const resetManualForm = () => {
    setEditingManualId(null);
    setManualForm(emptyManualFoodForm);
  };

  const editManualFood = (food: ManualFoodItem) => {
    setShowManualFood(true);
    setEditingManualId(food.id);
    setManualForm({
      nombre: food.nombre,
      aliases: (food.aliases ?? []).join(", "),
      categoria: food.categoria ?? "general",
      estado: food.estado ?? "natural",
      kcal_100g: numberText(food.kcal_100g),
      proteina_100g: numberText(food.proteina_100g),
      hidratos_100g: numberText(food.hidratos_100g),
      grasa_100g: numberText(food.grasa_100g),
      fibra_100g: numberText(food.fibra_100g),
      azucares_100g: numberText(food.azucares_100g),
      sal_100g: numberText(food.sal_100g),
      is_active: food.is_active,
    });
  };

  const saveManualFood = async (event: React.FormEvent) => {
    event.preventDefault();
    setManualSaving(true);
    const payload = {
      ...manualForm,
      aliases: splitAliases(manualForm.aliases),
      kcal_100g: numberOrNull(manualForm.kcal_100g),
      proteina_100g: numberOrNull(manualForm.proteina_100g),
      hidratos_100g: numberOrNull(manualForm.hidratos_100g),
      grasa_100g: numberOrNull(manualForm.grasa_100g),
      fibra_100g: numberOrNull(manualForm.fibra_100g),
      azucares_100g: numberOrNull(manualForm.azucares_100g),
      sal_100g: numberOrNull(manualForm.sal_100g),
    };
    console.info("[manual-food-items] formulario recibido", manualForm);
    console.info("[manual-food-items] objeto transformado antes de guardar", payload);
    const response = await fetchManualFoodsApi({
      method: editingManualId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingManualId ? { id: editingManualId, ...payload } : payload),
    });
    const result = await readApiPayload(response);
    console.info("[manual-food-items] respuesta completa de la API", {
      status: response.status,
      ok: response.ok,
      result,
    });
    setManualSaving(false);
    if (!response.ok) {
      const message = apiErrorMessage(result, "No se pudo guardar el alimento manual");
      console.error("[manual-food-items] error guardando", {
        status: response.status,
        response: result,
        payload,
      });
      toast.error(message);
      return;
    }
    toast.success(editingManualId ? "Alimento manual actualizado" : "Alimento manual creado");
    resetManualForm();
    setShowManualFood(true);
    await loadManualFoods();
  };

  const toggleManualFood = async (food: ManualFoodItem) => {
    const response = await fetchManualFoodsApi({
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...food, is_active: !food.is_active }),
    });
    const result = await readApiPayload(response);
    if (!response.ok) {
      toast.error(apiErrorMessage(result, "No se pudo cambiar el estado del alimento"));
      return;
    }
    toast.success(food.is_active ? "Alimento desactivado" : "Alimento activado");
    loadManualFoods();
  };

  const deleteManualFood = async (food: ManualFoodItem) => {
    if (!confirm("¿Seguro que deseas eliminar este alimento?")) return;
    const response = await fetchManualFoodsApi({
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: food.id }),
    });
    const result = await readApiPayload(response);
    if (!response.ok) {
      toast.error(apiErrorMessage(result, "No se pudo eliminar el alimento manual"));
      return;
    }
    if (editingManualId === food.id) resetManualForm();
    toast.success("Alimento manual eliminado");
    loadManualFoods();
  };

  const updateManualForm = (patch: Partial<ManualFoodForm>) => setManualForm(prev => ({ ...prev, ...patch }));

  const calculate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await calculateWithMacroSpecialist({
        ingredientsText,
        servings: Number(servings) || 1,
        category,
        containsHerbalife,
        preferences: preferences.trim() || undefined,
        restrictions: restrictions.trim() || undefined,
      });
      setResult(data);
      toast.success("Macros calculados");
    } catch (err: any) {
      toast.error(err?.message || "Error calculando macros");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-macro-specialist-page pb-28">
      <AdminPageHeader
        title="Especialista en macros"
        subtitle="Herramienta de prueba para calcular macros sin modificar recetas existentes."
      />

      <div className="card-soft p-4 space-y-4 mb-4">
        <div>
          <label className="text-xs muted">Ingredientes con gramos reales</label>
          <textarea
            className="field min-h-40"
            value={ingredientsText}
            onChange={e => setIngredientsText(e.target.value)}
            placeholder="Ej. pollo 200 g"
          />
          <p className="text-[11px] muted mt-1">Un ingrediente por línea. Si falta el gramaje, se marcará como pendiente de revisión.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs muted">Raciones</label>
            <input className="field" type="number" min="1" value={servings} onChange={e => setServings(e.target.value)} />
          </div>
          <div>
            <label className="text-xs muted">Categoría</label>
            <select className="field" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="comidas_saludables">Comidas saludables</option>
              <option value="almuerzos">Almuerzos</option>
              <option value="meriendas">Meriendas</option>
              <option value="nutricion_deportiva">Nutrición deportiva</option>
              <option value="biblioteca">Biblioteca oficial</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={containsHerbalife} onChange={e => setContainsHerbalife(e.target.checked)} className="h-4 w-4 accent-[hsl(330_80%_58%)]" />
          Contiene productos Herbalife
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs muted">Preferencias</label>
            <input className="field" value={preferences} onChange={e => setPreferences(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <label className="text-xs muted">Restricciones</label>
            <input className="field" value={restrictions} onChange={e => setRestrictions(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <button onClick={calculate} disabled={loading} className="btn-primary w-full">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Calculando…</> : <><Calculator className="h-4 w-4" /> Calcular macros</>}
        </button>
      </div>

      {result && <MacroResult result={result} />}

      {isAdmin && (
        <section className="card-soft p-4 space-y-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg">Alimentos manuales</h2>
              <p className="text-xs muted">Módulo independiente para crear, editar, activar o desactivar alimentos de la base.</p>
            </div>
            <button type="button" className="btn-primary" onClick={() => setShowManualManager(prev => !prev)}>
              {showManualManager ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showManualManager ? "Cerrar alimentos manuales" : "Gestionar alimentos manuales"}
            </button>
          </div>

          {showManualManager && (
            <>
              <div className="flex justify-end">
                <button type="button" className="btn-primary" onClick={() => setShowManualFood(prev => !prev)}>
                  {showManualFood ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {showManualFood ? "Cerrar formulario" : "Añadir alimento manual"}
                </button>
              </div>

              {showManualFood && (
                <form onSubmit={saveManualFood} className="rounded-2xl border border-primary/30 bg-white/70 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium">{editingManualId ? "Editar alimento manual" : "Nuevo alimento manual"}</h3>
                    {editingManualId && (
                      <button type="button" className="btn-ghost text-xs" onClick={resetManualForm}>
                        <X className="h-3.5 w-3.5" /> Cancelar edición
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-xs muted">Nombre del alimento</span>
                      <input className="field" value={manualForm.nombre} onChange={e => updateManualForm({ nombre: e.target.value })} required />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs muted">Categoría</span>
                      <input className="field" value={manualForm.categoria} onChange={e => updateManualForm({ categoria: e.target.value })} />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-xs muted">Alias opcionales</span>
                      <input className="field" value={manualForm.aliases} onChange={e => updateManualForm({ aliases: e.target.value })} placeholder="Separados por comas" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs muted">Estado</span>
                      <select className="field" value={manualForm.estado} onChange={e => updateManualForm({ estado: e.target.value })}>
                        <option value="crudo">Crudo</option>
                        <option value="cocido">Cocido</option>
                        <option value="natural">Natural</option>
                        <option value="procesado">Procesado</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {([
                      ["kcal_100g", "Kcal / 100 g", "1"],
                      ["proteina_100g", "Proteínas", "0.1"],
                      ["hidratos_100g", "Hidratos", "0.1"],
                      ["grasa_100g", "Grasas", "0.1"],
                      ["fibra_100g", "Fibra", "0.1"],
                      ["azucares_100g", "Azúcares", "0.1"],
                      ["sal_100g", "Sal", "0.01"],
                    ] as const).map(([key, label, step]) => (
                      <label key={key} className="space-y-1">
                        <span className="text-xs muted">{label}</span>
                        <input
                          className="field"
                          type="number"
                          step={step}
                          min="0"
                          value={manualForm[key]}
                          onChange={e => updateManualForm({ [key]: e.target.value } as Partial<ManualFoodForm>)}
                        />
                      </label>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={manualForm.is_active} onChange={e => updateManualForm({ is_active: e.target.checked })} className="h-4 w-4 accent-[hsl(330_80%_58%)]" />
                    Activo para buscador y cálculo de macros
                  </label>

                  <button className="btn-primary w-full" disabled={manualSaving}>
                    {manualSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingManualId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {manualSaving ? "Guardando…" : editingManualId ? "Guardar alimento manual" : "Crear alimento manual"}
                  </button>
                </form>
              )}

              <div className="rounded-2xl border border-primary/20 bg-white/60 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-4 w-4 muted" />
                  <input className="field" value={manualQuery} onChange={e => setManualQuery(e.target.value)} placeholder="Buscar alimentos manuales…" />
                </div>
                <div className="flex items-center justify-between text-xs muted mb-3">
                  <span>{manualLoading ? "Cargando…" : `${filteredManualFoods.length} alimentos manuales`}</span>
                  <span>Fuente: food_items</span>
                </div>
                <div className="space-y-2">
                  {filteredManualFoods.map(food => (
                    <div key={food.id} className={`rounded-2xl border p-3 ${food.is_active ? "border-border bg-secondary/60" : "border-dashed bg-muted/20 opacity-70"}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-primary" />
                            <h3 className="font-medium truncate">{food.nombre}</h3>
                            <span className="chip">{food.is_active ? "Activo" : "Inactivo"}</span>
                          </div>
                          <p className="text-xs muted mt-1">{food.categoria} · {food.estado} · {food.kcal_100g ?? "—"} kcal / 100 g</p>
                          {(food.aliases ?? []).length > 0 && <p className="text-xs muted mt-1">Alias: {food.aliases.join(", ")}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button type="button" className="btn-ghost text-xs" onClick={() => editManualFood(food)}>
                            <Edit3 className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button type="button" className="btn-ghost text-xs" onClick={() => toggleManualFood(food)}>
                            {food.is_active ? "Desactivar" : "Activar"}
                          </button>
                          <button type="button" className="btn-ghost text-xs text-destructive" onClick={() => deleteManualFood(food)}>
                            <Trash2 className="h-3.5 w-3.5" /> Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!manualLoading && filteredManualFoods.length === 0 && <p className="text-sm muted text-center py-4">Todavía no hay alimentos manuales.</p>}
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function MacroResult({ result }: { result: any }) {
  return (
    <div className="space-y-4">
      <section className="card-soft p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-serif text-lg">Resultado nutricional</h2>
          <span className="chip">{result.status}</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-center text-xs mb-4">
          <Stat label="Kcal/ración" value={result.perServing?.kcal} />
          <Stat label="Prot" value={`${result.perServing?.protein ?? 0}g`} />
          <Stat label="Hidr" value={`${result.perServing?.carbs ?? 0}g`} />
          <Stat label="Grasa" value={`${result.perServing?.fat ?? 0}g`} />
          <Stat label="Fibra" value={`${result.perServing?.fiber ?? 0}g`} />
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
          <Stat label="Kcal total" value={result.totals?.kcal} />
          <Stat label="Prot total" value={`${result.totals?.protein ?? 0}g`} />
          <Stat label="Hidr total" value={`${result.totals?.carbs ?? 0}g`} />
          <Stat label="Grasa total" value={`${result.totals?.fat ?? 0}g`} />
          <Stat label="Fibra total" value={`${result.totals?.fiber ?? 0}g`} />
        </div>
        <p className="text-[11px] muted mt-3">
          Fuente: {result.warnings?.dataSource}. Variables preparadas: {(result.envPrepared ?? []).join(", ")}.
        </p>
      </section>

      <section className="card-soft p-4">
        <h2 className="font-serif text-lg mb-2">Ingredientes encontrados</h2>
        {(result.found ?? []).length === 0 ? <p className="text-sm muted">No se encontró ningún ingrediente.</p> : (
          <div className="space-y-2">
            {result.found.map((item: any, index: number) => (
              <div key={index} className="rounded-2xl bg-secondary p-3 text-sm">
                <div className="font-medium">{item.name} · {item.grams} g</div>
                <div className="text-xs muted">
                  Fuente: {item.sourceLabel ?? "Base externa"} · Coincidencia: {item.displayName ?? item.matchedAs} · {item.macros?.kcal} kcal · {item.macros?.protein} g prot
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card-soft p-4">
        <h2 className="font-serif text-lg mb-2">Avisos</h2>
        {(result.notFound ?? []).length === 0 && (result.missingGrams ?? []).length === 0 ? (
          <p className="text-sm muted">Sin avisos. Todos los ingredientes tienen gramos y coincidencia interna.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {(result.notFound ?? []).map((item: any, index: number) => (
              <div key={`missing-${index}`} className="rounded-2xl bg-amber-50 border border-amber-200 p-3">No encontrado: {item.name}</div>
            ))}
            {(result.missingGrams ?? []).map((item: any, index: number) => (
              <div key={`grams-${index}`} className="rounded-2xl bg-rose-50 border border-rose-200 p-3">Sin gramos: {item.name}</div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="nutrition-stat">
      <div className="font-semibold">{value ?? "—"}</div>
      <div className="muted text-[9px] uppercase tracking-wide">{label}</div>
    </div>
  );
}
