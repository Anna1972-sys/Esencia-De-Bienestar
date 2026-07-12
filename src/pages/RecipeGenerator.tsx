import { useEffect, useMemo, useState } from "react";
import BackButton from "@/components/BackButton";
import { ArrowLeft, CheckCircle2, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { calculateWithMacroSpecialist, macrosFromSpecialist } from "@/lib/macroSpecialistClient";
import {
  DEFAULT_RECIPE_GENERATOR_CATEGORIES,
  loadRecipeGeneratorCategories,
  type RecipeGeneratorCategory,
} from "@/lib/recipeGeneratorCategories";
import imgRecipeGenerator from "@/assets/home-recipe-generator.png";

type RecipeCategory = string;

const ingredientsToMacroText = (ingredients: any[] = []) =>
  ingredients
    .map((item: any) => {
      if (typeof item === "string") return item;
      return `${item.quantity ?? ""} ${item.name ?? ""}`.trim();
    })
    .filter(Boolean)
    .join("\n");

const normalizeForDuplicate = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();

const ingredientSignature = (ingredients: any[] = []) =>
  ingredients
    .map((item: any) => normalizeForDuplicate(ingredientLabel(item)))
    .filter(Boolean)
    .sort()
    .join("|");

const firstUrl = (...values: any[]) =>
  values.find(value => typeof value === "string" && value.trim())?.trim() ?? null;

const isTemporaryImageUrl = (value: unknown) => {
  const url = String(value ?? "").trim();
  return !url || url.startsWith("data:image/") || url.includes("oaidalleapiprodscus.blob.core.windows.net");
};

const noMacroIngredientWords = [
  "agua",
  "sal",
  "pimienta",
  "especia",
  "especias",
  "hierba",
  "hierbas",
  "aromatica",
  "aromaticas",
  "orégano",
  "oregano",
  "perejil",
  "albahaca",
  "tomillo",
  "romero",
  "comino",
  "pimentón",
  "pimenton",
  "canela",
  "edulcorante",
  "edulcorantes",
  "stevia",
  "sacarina",
];

const normalizeIngredientText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ingredientLabel = (item: any) =>
  typeof item === "string" ? item : `${item.quantity ?? ""} ${item.name ?? ""}`.trim();

const ingredientName = (item: any) =>
  typeof item === "string" ? item : item?.name ?? ingredientLabel(item);

const isNoMacroIngredient = (item: any) => {
  const normalized = normalizeIngredientText(ingredientName(item));
  if (!normalized) return false;
  return noMacroIngredientWords.some(word => {
    const normalizedWord = normalizeIngredientText(word);
    return normalized === normalizedWord || normalized.includes(` ${normalizedWord} `) || normalized.startsWith(`${normalizedWord} `) || normalized.endsWith(` ${normalizedWord}`);
  });
};

const seasoningNote = (items: any[]) => {
  const names = items.map(ingredientName).map(normalizeIngredientText).join(" ");
  const hasSalt = names.includes("sal");
  const hasPepper = names.includes("pimienta");
  const hasSpices = ["especia", "hierba", "oregano", "perejil", "albahaca", "tomillo", "romero", "comino", "pimenton"].some(word => names.includes(word));
  if (hasSalt || hasPepper || hasSpices) {
    const parts = [
      hasSalt ? "sal" : "",
      hasPepper ? "pimienta" : "",
      hasSpices ? "especias o hierbas aromáticas" : "",
    ].filter(Boolean);
    return `${parts.join(", ").replace(/, ([^,]*)$/, " y $1")} al gusto.`;
  }
  return "Condimentar al gusto.";
};

const withSpecialistMacros = async (recipe: any, fallbackCategory: RecipeCategory, preferences?: string, restrictions?: string) => {
  const servings = Number(recipe?.servings) || 1;
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
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<RecipeGeneratorCategory[]>(DEFAULT_RECIPE_GENERATOR_CATEGORIES);
  const [category, setCategory] = useState<RecipeCategory>(DEFAULT_RECIPE_GENERATOR_CATEGORIES[0].id);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [preferences, setPreferences] = useState("");
  const [likes, setLikes] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [avoid, setAvoid] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [confirmDiscardGenerated, setConfirmDiscardGenerated] = useState(false);
  const [discardingGenerated, setDiscardingGenerated] = useState(false);

  const updateSavedRecipeId = (nextRecipeId: string | null) => {
    setSavedRecipeId(nextRecipeId);
  };

  const selectedCategory = useMemo(() => categories.find(c => c.id === category) ?? categories[0], [categories, category]);

  useEffect(() => {
    let mounted = true;
    loadRecipeGeneratorCategories(supabase as any).then(nextCategories => {
      if (!mounted) return;
      setCategories(nextCategories);
      setCategory(current => nextCategories.some(item => item.id === current) ? current : nextCategories[0]?.id ?? DEFAULT_RECIPE_GENERATOR_CATEGORIES[0].id);
    });
    return () => {
      mounted = false;
    };
  }, []);

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
    updateSavedRecipeId(null);

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
          preferences: [preferences.trim(), likes.trim() ? `Alimentos que le gustan: ${likes.trim()}` : ""].filter(Boolean).join(" · ") || undefined,
          dislikes: dislikes.trim() || undefined,
          avoid: avoid.trim() || undefined,
          servings: 1,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo generar la receta");
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      let enrichedRecipe = data.result;
      try {
        enrichedRecipe = await withSpecialistMacros(
          data.result,
          category,
          [preferences.trim(), likes.trim() ? `Alimentos que le gustan: ${likes.trim()}` : ""].filter(Boolean).join(" · "),
          [dislikes.trim(), avoid.trim()].filter(Boolean).join(" · "),
        );
      } catch (macroError: any) {
        console.error("[recipe-generator] no se pudieron recalcular macros al generar", macroError);
        toast.warning("Receta generada. Revisa los macros si es necesario.");
      }
      setResult(enrichedRecipe);
    } catch (err: any) {
      toast.error(err?.message || "Error generando receta");
    } finally {
      setLoading(false);
    }
  };

  const saveRecipe = async (
    r: any,
    options: { navigateAfterSave?: boolean; successMessage?: string } = {},
  ) => {
    if (!user) {
      toast.error("No hay sesión activa. Vuelve a iniciar sesión para guardar la receta.");
      return;
    }
    if (savedRecipeId) {
      toast.warning("Esta receta ya está guardada en Mis recetas. No se ha creado un duplicado.");
      if (options.navigateAfterSave !== false) navigate("/app/mis-recetas");
      return;
    }
    if (savingRecipe) return;
    setSavingRecipe(true);
    const servings = Number(r.servings) || 1;
    let enrichedRecipe = r;
    try {
      const alreadyHasMacros = ["calories", "protein", "carbs", "fat", "fiber"].some(key => Number(r?.macros?.[key] ?? 0) > 0);
      if (!alreadyHasMacros) {
        try {
          enrichedRecipe = await withSpecialistMacros(
            r,
            category,
            [preferences.trim(), likes.trim() ? `Alimentos que le gustan: ${likes.trim()}` : ""].filter(Boolean).join(" · "),
            [dislikes.trim(), avoid.trim()].filter(Boolean).join(" · "),
          );
        } catch (err: any) {
          console.error("[recipe-generator] se guarda sin recalcular macros", err);
          toast.warning("No se pudieron recalcular los macros, pero la receta se guardará igualmente.");
        }
      }

      let macros: any = enrichedRecipe.macros ?? {};
      macros = {
        ...macros,
        servings,
        nutrition_status: macros.nutrition_status ?? enrichedRecipe.nutrition_status ?? "estimated",
        nutrition_note: macros.nutrition_note ?? enrichedRecipe.nutrition_note ?? "Valores nutricionales estimados",
        nutrition_reference: enrichedRecipe.nutrition_reference ?? macros.nutrition_reference ?? "",
      };

      const recipeTitle = String(enrichedRecipe.title ?? "").trim();
      const recipeIngredients = Array.isArray(enrichedRecipe.ingredients) ? enrichedRecipe.ingredients : [];
      const currentSignature = ingredientSignature(recipeIngredients);
      const { data: existingRecipes, error: duplicateError } = await supabase
        .from("recipes")
        .select("id,title,ingredients")
        .eq("user_id", user.id)
        .eq("is_library", false)
        .eq("title", recipeTitle)
        .limit(20);
      if (duplicateError) throw duplicateError;
      const duplicate = (existingRecipes ?? []).find((item: any) => ingredientSignature(item.ingredients ?? []) === currentSignature);
      if (duplicate?.id) {
        updateSavedRecipeId(duplicate.id);
        toast.warning("Esta receta ya existe en Mis recetas. No se ha creado un duplicado.");
        if (options.navigateAfterSave !== false) navigate("/app/mis-recetas");
        return;
      }

      const recipeId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const imageUrl = firstUrl(
        enrichedRecipe.image_url,
        enrichedRecipe.imageUrl,
        enrichedRecipe.cover_image_url,
        enrichedRecipe.image?.url,
        enrichedRecipe.image
      );
      const finalImageUrl = isTemporaryImageUrl(imageUrl) ? null : imageUrl;
      const imageGenerationMetadata = finalImageUrl
        ? { image_generation_status: "ready", image_generation_error: "" }
        : {};
      const { error } = await supabase.from("recipes").insert({
        id: recipeId,
        user_id: user.id,
        title: recipeTitle,
        description: enrichedRecipe.description,
        category: enrichedRecipe.category ?? category,
        categories: [enrichedRecipe.category ?? category],
        servings,
        prep_time: enrichedRecipe.prep_time,
        image_url: finalImageUrl,
        macros: {
          ...macros,
          ...imageGenerationMetadata,
        },
        ingredients: recipeIngredients,
        steps: enrichedRecipe.steps ?? [],
        tags: Array.from(new Set([...(enrichedRecipe.tags ?? []), "Generador IA"])),
        is_library: false,
        is_featured: false,
        visibility: "private",
        is_high_protein: Number(macros?.protein ?? 0) >= 25,
      } as any);

      if (error) throw error;
      const savedRecipe = {
        ...enrichedRecipe,
        image_url: finalImageUrl,
        macros: {
          ...macros,
          ...imageGenerationMetadata,
        },
        servings,
      };
      setResult(savedRecipe);
      updateSavedRecipeId(recipeId);
      toast.success(options.successMessage ?? "Guardada en Mis recetas");
      if (options.navigateAfterSave !== false) navigate("/app/mis-recetas");
    } catch (err: any) {
      console.error("[recipe-generator] error guardando receta", err);
      toast.error(err?.message || "No se pudo guardar la receta");
    } finally {
      setSavingRecipe(false);
    }
  };

  const discardGeneratedRecipe = async () => {
    if (!user || !savedRecipeId) {
      setResult(null);
      updateSavedRecipeId(null);
      setConfirmDiscardGenerated(false);
      return;
    }
    setDiscardingGenerated(true);
    const { error } = await supabase.from("recipes").delete().eq("id", savedRecipeId).eq("user_id", user.id);
    setDiscardingGenerated(false);
    if (error) {
      toast.error(`No se pudo eliminar la receta: ${error.message}`);
      return;
    }
    setResult(null);
    updateSavedRecipeId(null);
    setConfirmDiscardGenerated(false);
    toast.success("Receta descartada correctamente.");
  };

  return (
    <div>
      <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>
      <section className="generator-hero-card mb-5">
        <img src={imgRecipeGenerator} alt="Plato saludable" className="generator-hero-image" />
        <div className="generator-hero-content">
          <h1>Crea tu plato con los ingredientes de tu nevera</h1>
          <p>Recetas para 1 persona con calorías, proteínas, hidratos, grasas y fibra calculados para una ración.</p>
        </div>
      </section>

      <div className="card-soft wellness-generator generator-ingredients-card p-5 mb-4">
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

        <div className="space-y-3 mt-6">
          <div>
            <label className="label">Preferencias personales</label>
            <input value={preferences} onChange={e => setPreferences(e.target.value)} className="field" placeholder="Ej. rápido, sin horno, más saciante…" />
          </div>
          <div>
            <label className="label">Alimentos que te gustan</label>
            <input value={likes} onChange={e => setLikes(e.target.value)} className="field" placeholder="Ej. salmón, yogur, fresas, aguacate…" />
          </div>
          <div>
            <label className="label">Alimentos que no te gustan</label>
            <input value={dislikes} onChange={e => setDislikes(e.target.value)} className="field" placeholder="Ej. cebolla, atún, brócoli…" />
          </div>
          <div>
            <label className="label">Alimentos que quieres evitar</label>
            <input value={avoid} onChange={e => setAvoid(e.target.value)} className="field" placeholder="Ej. lactosa, gluten, frutos secos…" />
          </div>
        </div>

        <button onClick={generate} disabled={loading} className="btn-primary w-full mt-6">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</> : <><Sparkles className="h-4 w-4" /> Generar receta</>}
        </button>
      </div>

      <div className="card-soft wellness-generator generator-options-card p-5 mb-5">
        <label className="label">Tipo de receta</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`recipe-type-marker text-left rounded-2xl border p-3 transition ${category === item.id ? "recipe-type-marker-selected border-primary shadow-sm" : "border-border bg-white/80"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{item.label}</span>
                {category === item.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
              </div>
              <p className="text-[11px] muted mt-1 leading-snug">{item.description}</p>
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-white/80 border border-primary/20 p-3 mt-5">
          <div className="text-xs font-semibold">{selectedCategory?.label}</div>
          <div className="text-[11px] muted mt-1">{selectedCategory?.description}</div>
        </div>

      </div>

      {result && (
        <RecipeCard
          recipe={result}
          categories={categories}
          saved={Boolean(savedRecipeId)}
          saving={savingRecipe}
          onSave={() => saveRecipe(result)}
          onRequestDiscard={() => setConfirmDiscardGenerated(true)}
        />
      )}
      {confirmDiscardGenerated && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
          <div className="card-soft w-full max-w-sm p-5 shadow-xl">
            <div className="font-semibold text-lg mb-2">Descartar receta</div>
            <p className="text-sm muted mb-4">¿Seguro que deseas descartar esta receta generada?</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setConfirmDiscardGenerated(false)} disabled={discardingGenerated}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={discardGeneratedRecipe} disabled={discardingGenerated}>
                {discardingGenerated ? "Descartando…" : "Descartar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecipeCard({
  recipe,
  categories,
  saved,
  saving,
  onSave,
  onRequestDiscard,
}: {
  recipe: any;
  categories: RecipeGeneratorCategory[];
  saved: boolean;
  saving: boolean;
  onSave: () => void;
  onRequestDiscard: () => void;
}) {
  const perServing = recipe.macros ?? {};
  const nutritionStatus = recipe.nutrition_status === "verified" ? "verified" : "estimated";
  const nutritionNote = nutritionStatus === "verified" ? "Valores nutricionales verificados" : "Valores nutricionales estimados";
  const categoryLabel = categories.find(item => item.id === recipe.category)?.label ?? recipe.category;
  const allIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const noMacroIngredients = allIngredients.filter(isNoMacroIngredient);
  const macroIngredients = allIngredients.filter((item: any) => !isNoMacroIngredient(item));
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const finalSeasoningNote = noMacroIngredients.length > 0 ? seasoningNote(noMacroIngredients) : "";

  return (
    <div className="card-soft generator-result-card p-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="heading-md">{recipe.title}</h2>
        {recipe.category && <span className="chip shrink-0">{categoryLabel}</span>}
      </div>
      <p className="muted text-sm">{recipe.description}</p>
      <div className="flex flex-wrap gap-2 my-3">
        {(recipe.tags ?? []).map((t: string) => <span key={t} className="chip">{t}</span>)}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mt-4">
        <div className="nutrition-stat text-left"><div className="font-semibold">{recipe.servings ?? 1}</div><div className="muted text-[10px] uppercase tracking-wide">Raciones</div></div>
        <div className="nutrition-stat text-left"><div className="font-semibold">{recipe.prep_time ?? "—"} min</div><div className="muted text-[10px] uppercase tracking-wide">Preparación</div></div>
      </div>

      <h3 className="font-serif text-base mt-4 mb-2">Información nutricional por ración</h3>
      <NutritionStats values={perServing} />
      <p className="text-[11px] muted mt-2">
        {nutritionNote}{recipe.nutrition_reference ? ` · Referencia: ${recipe.nutrition_reference}` : ""}
      </p>

      <h3 className="font-serif text-base mt-4 mb-1">Ingredientes con gramos exactos</h3>
      <ul className="text-sm space-y-1 list-disc pl-5 muted">
        {macroIngredients.map((i: any, k: number) => (
          <li key={k}>{ingredientLabel(i)}</li>
        ))}
      </ul>

      <h3 className="font-serif text-base mt-4 mb-1">Preparación</h3>
      <ol className="text-sm space-y-2 list-decimal pl-5">
        {steps.map((s: string, k: number) => <li key={k}>{s}</li>)}
        {finalSeasoningNote && <li>{finalSeasoningNote}</li>}
      </ol>
      <button onClick={onSave} disabled={saving} className="btn-primary w-full mt-5">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : saved ? "Guardada en Mis recetas" : "Guardar en Mis recetas"}
      </button>
      <button onClick={onRequestDiscard} className="btn-primary w-full mt-2">
        <Trash2 className="h-4 w-4" /> Descartar receta generada
      </button>
    </div>
  );
}

function NutritionStats({ values }: { values: any }) {
  const salt = Number(values?.micronutrients?.sal);
  const hasSalt = values?.micronutrients && Object.prototype.hasOwnProperty.call(values.micronutrients, "sal") && Number.isFinite(salt);
  return (
    <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-xs">
      <Stat label="Kcal" value={`${values.calories ?? 0}`} />
      <Stat label="Prot" value={`${values.protein ?? 0}g`} />
      <Stat label="Hidratos" value={`${values.carbs ?? 0}g`} />
      <Stat label="Grasas" value={`${values.fat ?? 0}g`} />
      <Stat label="Fibra" value={`${values.fiber ?? 0}g`} />
      {hasSalt && <Stat label="Sal" value={`${Math.round(salt * 100) / 100}g`} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="nutrition-stat"><div className="font-semibold">{value}</div><div className="muted text-[10px] uppercase tracking-wide">{label}</div></div>;
}
