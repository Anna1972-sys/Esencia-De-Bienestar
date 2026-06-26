import { useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";
import { calculateWithMacroSpecialist } from "@/lib/macroSpecialistClient";

const EXAMPLE = "pollo 200 g\narroz 120 g\ncalabacín 150 g\ntomate 100 g\naceite de oliva 10 g";

export default function AdminMacroSpecialist() {
  const [ingredientsText, setIngredientsText] = useState(EXAMPLE);
  const [servings, setServings] = useState("1");
  const [category, setCategory] = useState("comidas_saludables");
  const [containsHerbalife, setContainsHerbalife] = useState(false);
  const [preferences, setPreferences] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

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
    <div className="pb-28">
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
                <div className="text-xs muted">Coincidencia: {item.matchedAs} · {item.macros?.kcal} kcal · {item.macros?.protein} g prot</div>
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
