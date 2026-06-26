import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Plus, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { calculateWithMacroSpecialist, macrosFromSpecialist } from "@/lib/macroSpecialistClient";

type RecipeCategory = "comidas_saludables" | "almuerzos" | "meriendas" | "nutricion_deportiva";

const CATEGORIES: { id: RecipeCategory; label: string; description: string }[] = [
  { id: "comidas_saludables", label: "Comidas saludables", description: "450–500 kcal, alta en proteína y con verduras." },
  { id: "almuerzos", label: "Almuerzos", description: "Máximo 180 kcal, práctico y transportable." },
  { id: "meriendas", label: "Meriendas", description: "Máximo 180 kcal, fácil y alta en proteína." },
  { id: "nutricion_deportiva", label: "Nutrición deportiva", description: "Masa muscular, proteína y cantidades coherentes." },
];

const CATEGORY_LABEL: Record<RecipeCategory, string> = CATEGORIES.reduce((acc, item) => {
  acc[item.id] = item.label;
  return acc;
}, {} as Record<RecipeCategory, string>);

const ingredientsToMacroText = (ingredients: any[] = []) =>
  ingredients
    .map((item: any) => {
      if (typeof item === "string") return item;
      return `${item.quantity ?? ""} ${item.name ?? ""}`.trim();
    })
    .filter(Boolean)
    .join("\n");

const withSpecialistMacros = async (recipe: any, fallbackCategory: RecipeCategory, preferences?: string, restrictions?: string) => {
  const servings = Number(recipe?.servings) || 2;
  const ingredientsText = ingredientsToMacroText(recipe?.ingredients ?? []);
  if (!ingredientsText) return recipe;
  const macroResult = await calculateWithMacroSpecialist({
    ingredientsText,
    servings,
    category: recipe?.category ?? fallbackCategory,
    preferences: preferences || undefined,
    restrictions: restrictions || undefined,
  });
  const macros = macrosFromSpecialist(macroResult);
  return {
    ...recipe,
    servings,
    macros: {
      ...(recipe?.macros ?? {}),
      ...macros,
      servings,
    },
    nutrition_status: macros.nutrition_status,
    nutrition_note: macros.nutrition_note,
  };
};

export default function RecipeGenerator() {
  const { user } = useAuth();
  const [category, setCategory] = useState<RecipeCategory>("comidas_saludables");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [preferences, setPreferences] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [avoid, setAvoid] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const selectedCategory = useMemo(() => CATEGORIES.find(c => c.id === category), [category]);

  const parseIngredients = (text: string): string[] => {
    return text
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
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
      return toast.error("Añade los ingredientes que tienes en casa");
    }

    setLoading(true);
    setDraft("");
    setIngredients(finalIngredients);
    setResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/generate-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
        },
        body: JSON.stringify({
          category,
          ingredients: finalIngredients,
          preferences: preferences.trim() || undefined,
          dislikes: dislikes.trim() || undefined,
          avoid: avoid.trim() || undefined,
          servings: 2,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo generar la receta");
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      const enrichedRecipe = await withSpecialistMacros(
        data.result,
        category,
        preferences.trim(),
        [dislikes.trim(), avoid.trim()].filter(Boolean).join(" · "),
      );
      setResult(enrichedRecipe);
      toast.success("Receta generada");
    } catch (err: any) {
      toast.error(err?.message || "Error generando receta");
    } finally {
      setLoading(false);
    }
  };

  const saveRecipe = async (r: any) => {
    if (!user) return;
    const servings = Number(r.servings) || 2;
    let enrichedRecipe = r;
    try {
      enrichedRecipe = await withSpecialistMacros(
        r,
        category,
        preferences.trim(),
        [dislikes.trim(), avoid.trim()].filter(Boolean).join(" · "),
      );
    } catch (err: any) {
      toast.error(err?.message || "No se pudieron calcular los macros de la receta");
      return;
    }
    let macros: any = enrichedRecipe.macros ?? {};
    macros = {
      ...macros,
      servings,
      nutrition_status: macros.nutrition_status ?? enrichedRecipe.nutrition_status ?? "estimated",
      nutrition_note: macros.nutrition_note ?? enrichedRecipe.nutrition_note ?? "Valores nutricionales estimados",
      nutrition_reference: enrichedRecipe.nutrition_reference ?? macros.nutrition_reference ?? "",
    };

    const { data, error } = await supabase.from("recipes").insert({
      user_id: user.id,
      title: enrichedRecipe.title,
      description: enrichedRecipe.description,
      category: enrichedRecipe.category ?? category,
      categories: [enrichedRecipe.category ?? category],
      servings,
      prep_time: enrichedRecipe.prep_time,
      macros,
      ingredients: enrichedRecipe.ingredients ?? [],
      steps: enrichedRecipe.steps ?? [],
      tags: Array.from(new Set([...(enrichedRecipe.tags ?? []), "Generador IA"])),
      is_library: false,
      is_featured: false,
      visibility: "private",
      is_high_protein: Number(macros?.protein ?? 0) >= 25,
    } as any).select().single();

    if (error) return toast.error(error.message);
    toast.success("Guardada en Mis recetas");
    return data;
  };

  return (
    <div>
      <Link to="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <h1 className="heading-lg mb-1">Generador IA</h1>
      <p className="muted text-sm mb-5">Recetas para 2 personas. Los valores nutricionales (calorías, proteínas, hidratos de carbono, grasas y fibra) están calculados por persona.</p>

      <div className="card-soft wellness-generator p-5 mb-5">
        <label className="label">Tipo de receta</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`text-left rounded-2xl border p-3 transition ${category === item.id ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-white/80"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{item.label}</span>
                {category === item.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
              </div>
              <p className="text-[11px] muted mt-1 leading-snug">{item.description}</p>
            </button>
          ))}
        </div>

        <label className="label">Ingredientes que tienes en casa</label>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addIng())}
            className="field flex-1"
            placeholder="Ej. pollo, calabacín, tomate, arroz…"
          />
          <button onClick={addIng} className="btn-ghost px-3" title="Añadir"><Plus className="h-4 w-4" /></button>
        </div>
        <p className="text-[11px] muted mt-1.5">Si no indicas preferencias o restricciones, la receta se genera solo con estos ingredientes como base.</p>

        {ingredients.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {ingredients.map((i, idx) => (
              <span key={`${i}-${idx}`} className="chip">
                {i}
                <button onClick={() => setIngredients(ingredients.filter((_, j) => j !== idx))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}

        <div className="space-y-3 mt-5">
          <div>
            <label className="label">Preferencias personales</label>
            <input value={preferences} onChange={e => setPreferences(e.target.value)} className="field" placeholder="Ej. rápido, sin horno, más saciante…" />
          </div>
          <div>
            <label className="label">Alimentos que no te gustan</label>
            <input value={dislikes} onChange={e => setDislikes(e.target.value)} className="field" placeholder="Ej. cebolla, atún, brócoli…" />
          </div>
          <div>
            <label className="label">Alimentos que no puedes tomar o quieres evitar</label>
            <input value={avoid} onChange={e => setAvoid(e.target.value)} className="field" placeholder="Ej. lactosa, gluten, frutos secos…" />
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 border border-primary/20 p-3 mt-5">
          <div className="text-xs font-semibold">{selectedCategory?.label}</div>
          <div className="text-[11px] muted mt-1">{selectedCategory?.description}</div>
        </div>

        <button onClick={generate} disabled={loading} className="btn-primary w-full mt-5">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</> : <><Sparkles className="h-4 w-4" /> Generar receta</>}
        </button>
      </div>

      {result && <RecipeCard recipe={result} onSave={() => saveRecipe(result)} />}
    </div>
  );
}

function RecipeCard({ recipe, onSave }: { recipe: any; onSave: () => void }) {
  const perServing = recipe.macros ?? {};
  const nutritionStatus = recipe.nutrition_status === "verified" ? "verified" : "estimated";
  const nutritionNote = nutritionStatus === "verified" ? "Valores nutricionales verificados" : "Valores nutricionales estimados";

  return (
    <div className="card-soft p-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="heading-md">{recipe.title}</h2>
        {recipe.category && <span className="chip shrink-0">{CATEGORY_LABEL[recipe.category as RecipeCategory] ?? recipe.category}</span>}
      </div>
      <p className="muted text-sm">{recipe.description}</p>
      <div className="flex flex-wrap gap-2 my-3">
        {(recipe.tags ?? []).map((t: string) => <span key={t} className="chip">{t}</span>)}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mt-4">
        <div className="nutrition-stat text-left"><div className="font-semibold">{recipe.servings ?? 2}</div><div className="muted text-[10px] uppercase tracking-wide">Raciones</div></div>
        <div className="nutrition-stat text-left"><div className="font-semibold">{recipe.prep_time ?? "—"} min</div><div className="muted text-[10px] uppercase tracking-wide">Preparación</div></div>
      </div>

      <h3 className="font-serif text-base mt-4 mb-2">Información nutricional por ración</h3>
      <NutritionStats values={perServing} />
      <p className="text-[11px] muted mt-2">
        {nutritionNote}{recipe.nutrition_reference ? ` · Referencia: ${recipe.nutrition_reference}` : ""}
      </p>

      <h3 className="font-serif text-base mt-4 mb-1">Ingredientes con gramos exactos</h3>
      <ul className="text-sm space-y-1 list-disc pl-5 muted">
        {(recipe.ingredients ?? []).map((i: any, k: number) => (
          <li key={k}>{typeof i === "string" ? i : `${i.quantity ?? ""} ${i.name ?? ""}`.trim()}</li>
        ))}
      </ul>

      <h3 className="font-serif text-base mt-4 mb-1">Preparación</h3>
      <ol className="text-sm space-y-2 list-decimal pl-5">{(recipe.steps ?? []).map((s: string, k: number) => <li key={k}>{s}</li>)}</ol>
      <button onClick={onSave} className="btn-primary w-full mt-5">Guardar en mis recetas</button>
    </div>
  );
}

function NutritionStats({ values }: { values: any }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
      <Stat label="Prot" value={`${values.protein ?? 0}g`} />
      <Stat label="Hidratos" value={`${values.carbs ?? 0}g`} />
      <Stat label="Grasas" value={`${values.fat ?? 0}g`} />
      <Stat label="Fibra" value={`${values.fiber ?? 0}g`} />
      <Stat label="Kcal" value={`${values.calories ?? 0}`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="nutrition-stat"><div className="font-semibold">{value}</div><div className="muted text-[10px] uppercase tracking-wide">{label}</div></div>;
}
