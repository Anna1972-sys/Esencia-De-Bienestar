import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, Plus, X, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "ingredients" | "preferences" | "monthly";

export default function RecipeGenerator() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("ingredients");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [highProtein, setHighProtein] = useState(true);
  const [targetCalories, setTargetCalories] = useState<string>("");
  const [allergies, setAllergies] = useState("");
  const [mealType, setMealType] = useState("comida");
  const [maxTime, setMaxTime] = useState<string>("30");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [monthlyResult, setMonthlyResult] = useState<any[] | null>(null);

  const parseIngredients = (text: string): string[] => {
    return text.split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  const addIng = () => {
    const parsed = parseIngredients(draft);
    if (parsed.length === 0) return;
    setIngredients([...ingredients, ...parsed]);
    setDraft("");
  };

  const generate = async () => {
    const finalIngredients = draft.trim()
      ? [...ingredients, ...parseIngredients(draft)]
      : ingredients;

    if (finalIngredients.length === 0) {
      return toast.error("Añade ingredientes con sus cantidades exactas para 2 personas");
    }
    setLoading(true);
    setDraft("");
    setIngredients(finalIngredients);
    setResult(null); setMonthlyResult(null);
    const preferences = mode === "ingredients" ? {} : {
      highProtein,
      targetCalories: targetCalories ? Number(targetCalories) : undefined,
      allergies: allergies || undefined,
      mealType,
      maxTime: maxTime ? Number(maxTime) : undefined,
    };
    const { data, error } = await supabase.functions.invoke("generate-recipe", { body: { mode, ingredients: finalIngredients, preferences, servings: 2 } });
    setLoading(false);
    if (error) return toast.error(error.message || "Error generando receta");
    if (data?.error) return toast.error(data.error);
    if (mode === "monthly") {
      const list = data?.result?.recipes ?? [];
      setMonthlyResult(list);
      toast.success(`Plan generado con ${list.length} recetas`);
    } else {
      const r = data?.result;
      if (r?.error === "insufficient_ingredients") {
        return toast.error("Esos ingredientes no son suficientes para una receta. Añade alguno más.");
      }
      if (r?.error === "missing_ingredients") {
        return toast.error("Añade al menos un ingrediente");
      }
      setResult(r);
    }
  };

  const saveRecipe = async (r: any) => {
    if (!user) return;
    const { data, error } = await supabase.from("recipes").insert({
      user_id: user.id,
      title: r.title,
      description: r.description,
      servings: 2,
      prep_time: r.prep_time,
      macros: r.macros ?? {},
      ingredients: r.ingredients ?? [],
      steps: r.steps ?? [],
      tags: r.tags ?? [],
      is_high_protein: r.nutrition_status === "verified" && (r.macros?.protein ?? 0) >= 25,
    }).select().single();
    if (error) return toast.error(error.message);
    toast.success("Guardada en Mis recetas");
    return data;
  };

  const saveMonthly = async () => {
    if (!user || !monthlyResult) return;
    const month = new Date().toISOString().slice(0, 7);
    const { error } = await supabase.from("meal_plans").insert({ user_id: user.id, month, recipes: monthlyResult });
    if (error) return toast.error(error.message);
    toast.success("Plan mensual guardado");
  };

  return (
    <div>
      <Link to="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <h1 className="heading-lg mb-1">Generador IA</h1>
      <p className="muted text-sm mb-5">Recetas para 2 personas, con cantidades y nutrición desglosada por ración.</p>

      <div className="grid grid-cols-3 gap-1.5 bg-muted/60 p-1 rounded-full mb-5 text-xs">
        {([["ingredients","Ingredientes"],["preferences","+ Preferencias"],["monthly","Plan mensual"]] as [Mode,string][]).map(([k,l]) => (
          <button key={k} onClick={() => setMode(k)} className={`py-2 rounded-full font-medium transition ${mode===k ? "bg-white shadow text-foreground" : "muted"}`}>{l}</button>
        ))}
      </div>

      <div className="card-soft wellness-generator p-5 mb-5">
        <label className="label">Ingredientes para 2 personas</label>
        <div className="flex gap-2">
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addIng())} className="field flex-1" placeholder="Ej. 300 g de pollo, 160 g de arroz…" />
          <button onClick={addIng} className="btn-ghost px-3" title="Añadir"><Plus className="h-4 w-4" /></button>
        </div>
        <p className="text-[11px] muted mt-1.5">Indica siempre las cantidades reales. No se calculan macros sin una referencia verificable.</p>
        {ingredients.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {ingredients.map((i, idx) => (
              <span key={idx} className="chip">{i}<button onClick={() => setIngredients(ingredients.filter((_,j) => j!==idx))}><X className="h-3 w-3" /></button></span>
            ))}
          </div>
        )}

        {mode !== "ingredients" && (
          <div className="space-y-4 mt-5">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={highProtein} onChange={e => setHighProtein(e.target.checked)} className="h-4 w-4 accent-[hsl(330_80%_58%)]" /> Alta en proteína</label>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Calorías por porción</label><input type="number" value={targetCalories} onChange={e => setTargetCalories(e.target.value)} className="field" placeholder="ej. 450" /></div>
              <div><label className="label">Tiempo máx (min)</label><input type="number" value={maxTime} onChange={e => setMaxTime(e.target.value)} className="field" placeholder="30" /></div>
            </div>
            <div>
              <label className="label">Tipo de comida</label>
              <select value={mealType} onChange={e => setMealType(e.target.value)} className="field">
                {["desayuno","comida","cena","snack"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div><label className="label">Alergias / a evitar</label><input value={allergies} onChange={e => setAllergies(e.target.value)} className="field" placeholder="ej. lactosa, frutos secos" /></div>
          </div>
        )}

        <button onClick={generate} disabled={loading} className="btn-primary w-full mt-5">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</> : <><Sparkles className="h-4 w-4" /> Generar {mode === "monthly" ? "plan mensual" : "receta"}</>}
        </button>
      </div>

      {result && <RecipeCard recipe={result} onSave={() => saveRecipe(result)} />}

      {monthlyResult && (
        <div className="mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="heading-md">Plan mensual ({monthlyResult.length})</h2>
            <button onClick={saveMonthly} className="btn-ghost text-sm">Guardar plan</button>
          </div>
          {monthlyResult.map((r, i) => (
            <details key={i} className="card-soft p-4">
              <summary className="cursor-pointer font-medium flex justify-between items-center">
                <span>{r.title}</span>
                <span className="text-xs muted">{r.nutrition_status === "verified" ? `${r.macros?.protein ?? 0}g prot · ${r.macros?.calories ?? 0} kcal` : "Nutrición pendiente de verificación"}</span>
              </summary>
              <div className="mt-3 text-sm space-y-2">
                <p className="muted">{r.description}</p>
                <button onClick={() => saveRecipe(r)} className="btn-ghost text-xs">Guardar receta</button>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, onSave }: { recipe: any; onSave: () => void }) {
  const perServing = recipe.macros ?? {};
  const total = recipe.total_macros ?? recipe.macros_total ?? null;
  const nutritionAvailable = recipe.nutrition_status === "verified" && Boolean(recipe.nutrition_reference?.trim()) && (Number(perServing.protein) > 0 || Number(perServing.carbs) > 0 || Number(perServing.fat) > 0 || Number(perServing.calories) > 0);
  return (
    <div className="card-soft p-5 animate-fade-in">
      <h2 className="heading-md mb-1">{recipe.title}</h2>
      <p className="muted text-sm">{recipe.description}</p>
      <div className="flex flex-wrap gap-2 my-3">
        {(recipe.tags ?? []).map((t: string) => <span key={t} className="chip">{t}</span>)}
      </div>
      <div className="text-sm font-medium mt-4">Raciones: 2 personas</div>
      <div className="text-sm muted mt-1">Tiempo de preparación: {recipe.prep_time ?? "No indicado"} min</div>
      {nutritionAvailable ? <>
        <h3 className="font-serif text-base mt-4 mb-2">Información nutricional por ración (1 persona)</h3>
        <NutritionStats values={perServing} />
        {total && <>
          <h3 className="font-serif text-base mt-4 mb-2">Información nutricional total (2 personas)</h3>
          <NutritionStats values={total} />
        </>}
        {recipe.nutrition_reference && <p className="text-[11px] muted mt-2">Referencia nutricional: {recipe.nutrition_reference}</p>}
      </> : <p className="card-soft p-3 text-sm muted mt-4">No se muestran valores nutricionales porque no se pudo verificar una referencia nutricional suficiente para todos los ingredientes.</p>}
      <h3 className="font-serif text-base mt-4 mb-1">Ingredientes (2 personas)</h3>
      <ul className="text-sm space-y-1 list-disc pl-5 muted">
        {(recipe.ingredients ?? []).map((i: any, k: number) => <li key={k}>{typeof i === "string" ? i : `${i.quantity ?? ""} ${i.name ?? ""}`}</li>)}
      </ul>
      <h3 className="font-serif text-base mt-4 mb-1">Preparación</h3>
      <ol className="text-sm space-y-2 list-decimal pl-5">{(recipe.steps ?? []).map((s: string, k: number) => <li key={k}>{s}</li>)}</ol>
      <button onClick={onSave} className="btn-primary w-full mt-5">Guardar en mis recetas</button>
    </div>
  );
}

function NutritionStats({ values }: { values: any }) {
  return <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
    <Stat label="Prot" value={`${values.protein ?? 0}g`} />
    <Stat label="Carb" value={`${values.carbs ?? 0}g`} />
    <Stat label="Grasa" value={`${values.fat ?? 0}g`} />
    <Stat label="Fibra" value={`${values.fiber ?? 0}g`} />
    <Stat label="Kcal" value={`${values.calories ?? 0}`} />
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="nutrition-stat"><div className="font-semibold">{value}</div><div className="muted text-[10px] uppercase tracking-wide">{label}</div></div>;
}
