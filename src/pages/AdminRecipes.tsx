import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Calculator, Copy, Eye, Plus, Save, Sparkles, Star, Trash2, Upload, X } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";
import { LIBRARY_CATEGORIES, getCategoryLabel } from "@/lib/libraryCategories";
import VideoField from "@/components/VideoField";
import { calculateWithMacroSpecialist, macrosFromSpecialist } from "@/lib/macroSpecialistClient";
import { normalizeRecipeImageUrl, recipeImagePublicUrl } from "@/lib/recipeImages";
import { recordAppError } from "@/lib/appErrorLogger";

const QTY_RE = /\d/;
const ADMIN_RECIPE_DRAFT_KEY = "admin-recipes-editor-draft-v1";
const ADMIN_RECIPE_CATEGORY_KEY = "admin-recipes-active-category-v1";
const RECIPES_PAGE_SIZE = 8;

type OfficialStatus = "visible" | "hidden" | "featured";
type QualityFilter = "all" | "issues" | "complete";

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
  sort_order?: number | null;
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
const positiveNumberText = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? numberText(number) : numberText(fallback);
};

const isCalorieGuidanceRecipe = (recipe: Pick<RecipeRow, "title" | "description">) => {
  const text = `${recipe.title ?? ""} ${recipe.description ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    (text.includes("orientacion") && text.includes("caloria")) ||
    (text.includes("repetir") && text.includes("almuerzo") && text.includes("merienda"))
  );
};

const rememberedRecipeCategory = () => {
  if (typeof window === "undefined") return LIBRARY_CATEGORIES[0].id;
  const saved = window.localStorage.getItem(ADMIN_RECIPE_CATEGORY_KEY);
  return LIBRARY_CATEGORIES.some(category => category.id === saved)
    ? saved as string
    : LIBRARY_CATEGORIES[0].id;
};

const ingredientToText = (item: any) => {
  if (!item) return "";
  if (typeof item === "string") return item.trim();
  if (typeof item !== "object") return String(item).trim();

  const name = String(
    item.name ??
    item.ingredient ??
    item.food ??
    item.food_name ??
    item.label ??
    item.title ??
    item.text ??
    item.raw ??
    ""
  ).trim();
  const quantityValue = item.quantity ?? item.amount ?? item.qty ?? "";
  const unit = String(item.unit ?? item.units ?? "").trim();
  const grams = item.grams ?? item.gramos ?? item.weight_g ?? item.weight;
  const quantity = String(
    quantityValue ||
    (grams !== undefined && grams !== null && grams !== "" ? `${grams} g` : "")
  ).trim();

  if (quantity && name) {
    const quantityWithUnit = unit && !quantity.toLowerCase().includes(unit.toLowerCase()) ? `${quantity} ${unit}` : quantity;
    return `${quantityWithUnit} ${name}`.trim();
  }
  return name || quantity;
};

const ingredientsToText = (ingredients: any) =>
  Array.isArray(ingredients)
    ? ingredients.map(ingredientToText).filter(Boolean).join("\n")
    : typeof ingredients === "string" ? ingredients.trim() : "";

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

const manualRecipeOrder = (recipe: Pick<RecipeRow, "sort_order">) => {
  const value = Number(recipe.sort_order ?? 0);
  return Number.isFinite(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
};

const compareRecipesByManualOrder = (a: RecipeRow, b: RecipeRow) => {
  const orderDiff = manualRecipeOrder(a) - manualRecipeOrder(b);
  if (orderDiff !== 0) return orderDiff;
  const dateDiff = new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  if (dateDiff !== 0) return dateDiff;
  return String(a.title ?? "").localeCompare(String(b.title ?? ""), "es", { sensitivity: "base" });
};

const detectedRecipeQualityIssues = (recipe: RecipeRow) => {
  const issues: string[] = [];
  const ingredientLines = ingredientsToText(recipe.ingredients).split("\n").map(line => line.trim()).filter(Boolean);
  const macros = recipe.macros ?? {};
  if (!normalizeRecipeImageUrl(recipe.image_url)) issues.push("Imagen pendiente");
  if (!ingredientLines.length || ingredientLines.some(line => !QTY_RE.test(line))) issues.push("Cantidades incompletas");
  if (
    macros.nutrition_status === "pending_review" ||
    !Number(macros.calories) ||
    !Number(macros.protein)
  ) issues.push("Macros pendientes");
  if (!String(recipe.description ?? "").trim()) issues.push("Descripción vacía");
  if (!String(recipe.video_url ?? "").trim()) issues.push("Sin vídeo");
  if (!stepsToText(recipe.steps).trim()) issues.push("Sin pasos");
  return issues;
};

const ignoredRecipeQualityIssues = (recipe: RecipeRow) =>
  Array.isArray(recipe.macros?.quality_ignored)
    ? recipe.macros.quality_ignored.map(String)
    : [];

const canReviewQualityIssues = (recipe: RecipeRow) => {
  const category = String(recipe.category ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  return category === "snacks" || category === "almuerzos" || category === "meriendas";
};

const recipeQualityIssues = (recipe: RecipeRow) => {
  if (!canReviewQualityIssues(recipe)) return detectedRecipeQualityIssues(recipe);
  const ignored = new Set(ignoredRecipeQualityIssues(recipe));
  return detectedRecipeQualityIssues(recipe).filter(issue => !ignored.has(issue));
};

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

const formHasDraftContent = (form: LibForm) =>
  Boolean(
    form.title.trim() ||
    form.description.trim() ||
    form.ingredients.trim() ||
    form.steps.trim() ||
    form.tags.trim() ||
    form.image_url.trim() ||
    form.video_url.trim() ||
    form.prep_time.trim() ||
    (form.servings.trim() && form.servings.trim() !== "1") ||
    ["protein", "carbs", "fat", "calories", "fiber"].some((key) => String((form as any)[key] ?? "0") !== "0")
  );

type RecipeEditorDraft = {
  editingId: string | null;
  form: LibForm;
  savedAt: string;
};

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
  image_url: normalizeRecipeImageUrl(recipe.image_url),
  video_url: recipe.video_url ?? "",
});

const missingIngredientNames = (data: any) => [
  ...(data?.notFound ?? []).map((item: any) => item?.name ?? item).filter(Boolean),
  ...(data?.missingGrams ?? []).map((item: any) => item?.name ?? item).filter(Boolean),
];

const INGREDIENT_QTY_RE = /^\s*\d+(?:[.,]\d+)?\s*(g|gr|gramos?|ml|mililitros?|unidad(?:es)?|unidades|raci[oó]n(?:es)?|cucharaditas?|cucharadas?|dientes?)\b/i;
const hasIncompleteIngredientLines = (text: string) => parseLines(text).some(line => !INGREDIENT_QTY_RE.test(line));
const completedIngredientToLine = (item: any) => {
  const name = String(item?.name ?? "").trim();
  const quantity = String(item?.quantity ?? "").trim();
  const grams = Number(item?.grams);
  const fallback = Number.isFinite(grams) && grams > 0 ? `${grams} g` : "";
  return `${quantity || fallback} ${name}`.replace(/\s+/g, " ").trim();
};

const completeRecipeQuantities = async (payload: {
  title: string;
  category: string;
  servings: string | number;
  ingredients: string[];
  steps: string[];
}) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Debes iniciar sesión como administradora");
  const response = await fetch("/api/complete-recipe-quantities", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "No se pudieron completar las cantidades");
  return data as { servings: number; ingredients: any[]; notice?: string };
};

export default function AdminRecipes() {
  const [items, setItems] = useState<RecipeRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recipeFormOpen, setRecipeFormOpen] = useState(false);
  const [form, setForm] = useState<LibForm>(() => ({ ...emptyForm, category: rememberedRecipeCategory() }));
  const [filterCat, setFilterCat] = useState(rememberedRecipeCategory);
  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const [visibleLimit, setVisibleLimit] = useState(RECIPES_PAGE_SIZE);
  const [recipeToDelete, setRecipeToDelete] = useState<RecipeRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [macroDebug, setMacroDebug] = useState<any[]>([]);
  const [lastMacroWarning, setLastMacroWarning] = useState("");
  const [completingQuantities, setCompletingQuantities] = useState(false);
  const [quantityNotice, setQuantityNotice] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [availableDraft, setAvailableDraft] = useState<RecipeEditorDraft | null>(null);
  const [changingCategoryId, setChangingCategoryId] = useState<string | null>(null);
  const [changingQualityId, setChangingQualityId] = useState<string | null>(null);
  const [expandedRecipeIds, setExpandedRecipeIds] = useState<Record<string, boolean>>({});
  const [savingGuidance, setSavingGuidance] = useState(false);
  const [uploadingGuidance, setUploadingGuidance] = useState<"lunch" | "snack" | "meal" | "dinner" | "breakfast" | null>(null);

  const editingRecipe = useMemo(() => items.find(item => item.id === editingId) ?? null, [items, editingId]);
  const guidanceRecipe = useMemo(() => items.find(isCalorieGuidanceRecipe) ?? null, [items]);
  const [guidanceForm, setGuidanceForm] = useState({
    lunchImage: "",
    snackImage: "",
    caloriesMin: "150",
    caloriesMax: "170",
    proteinMin: "10",
    proteinMax: "20",
    mealImage: "",
    mealCaloriesMax: "500",
    mealProteinMin: "20",
    mealProteinMax: "35",
    dinnerImage: "",
    dinnerCaloriesMax: "300",
    dinnerProteinMin: "20",
    dinnerProteinMax: "30",
    breakfastImage: "",
    breakfastCaloriesMax: "250",
    breakfastProteinMin: "25",
    breakfastProteinMax: "30",
  });

  useEffect(() => {
    if (!guidanceRecipe) return;
    setGuidanceForm({
      lunchImage:
        normalizeRecipeImageUrl(guidanceRecipe.image_url) ||
        LIBRARY_CATEGORIES.find(category => category.id === "comidas")?.image ||
        "",
      snackImage:
        normalizeRecipeImageUrl(guidanceRecipe.macros?.guidance_image_secondary) ||
        LIBRARY_CATEGORIES.find(category => category.id === "meriendas")?.image ||
        "",
      caloriesMin: positiveNumberText(guidanceRecipe.macros?.guidance_calories_min, 150),
      caloriesMax: positiveNumberText(guidanceRecipe.macros?.guidance_calories_max, 170),
      proteinMin: positiveNumberText(guidanceRecipe.macros?.guidance_protein_min, 10),
      proteinMax: positiveNumberText(guidanceRecipe.macros?.guidance_protein_max, 20),
      mealImage:
        normalizeRecipeImageUrl(guidanceRecipe.macros?.guidance_meal_image) ||
        LIBRARY_CATEGORIES.find(category => category.id === "comidas")?.image ||
        "",
      mealCaloriesMax: positiveNumberText(guidanceRecipe.macros?.guidance_meal_calories_max, 500),
      mealProteinMin: positiveNumberText(guidanceRecipe.macros?.guidance_meal_protein_min, 20),
      mealProteinMax: positiveNumberText(guidanceRecipe.macros?.guidance_meal_protein_max, 35),
      dinnerImage:
        normalizeRecipeImageUrl(guidanceRecipe.macros?.guidance_dinner_image) ||
        LIBRARY_CATEGORIES.find(category => category.id === "cenas_sin_herbalife")?.image ||
        "",
      dinnerCaloriesMax: positiveNumberText(guidanceRecipe.macros?.guidance_dinner_calories_max, 300),
      dinnerProteinMin: positiveNumberText(guidanceRecipe.macros?.guidance_dinner_protein_min, 20),
      dinnerProteinMax: positiveNumberText(guidanceRecipe.macros?.guidance_dinner_protein_max, 30),
      breakfastImage:
        normalizeRecipeImageUrl(guidanceRecipe.macros?.guidance_breakfast_image) ||
        normalizeRecipeImageUrl(items.find(recipe => String(recipe.title ?? "").toLowerCase().includes("formula"))?.image_url) ||
        LIBRARY_CATEGORIES.find(category => category.id === "desayunos_sin_herbalife")?.image ||
        "",
      breakfastCaloriesMax: positiveNumberText(guidanceRecipe.macros?.guidance_breakfast_calories_max, 250),
      breakfastProteinMin: positiveNumberText(guidanceRecipe.macros?.guidance_breakfast_protein_min, 25),
      breakfastProteinMax: positiveNumberText(guidanceRecipe.macros?.guidance_breakfast_protein_max, 30),
    });
  }, [guidanceRecipe, items]);

  const uploadGuidanceImage = async (
    side: "lunch" | "snack" | "meal" | "dinner" | "breakfast",
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingGuidance(side);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("recipe-images")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const url = recipeImagePublicUrl(path);
      const imageField = {
        lunch: "lunchImage",
        snack: "snackImage",
        meal: "mealImage",
        dinner: "dinnerImage",
        breakfast: "breakfastImage",
      }[side] as "lunchImage" | "snackImage" | "mealImage" | "dinnerImage" | "breakfastImage";
      setGuidanceForm(current => ({
        ...current,
        [imageField]: url,
      }));
      toast.success("Imagen preparada. Pulsa Guardar orientación.");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo subir la imagen");
    } finally {
      setUploadingGuidance(null);
      event.target.value = "";
    }
  };

  const saveGuidance = async () => {
    if (!guidanceRecipe) {
      toast.error("No se encontró la tarjeta de orientación");
      return;
    }
    setSavingGuidance(true);
    try {
      const macros = {
        ...(guidanceRecipe.macros ?? {}),
        guidance_image_secondary: guidanceForm.snackImage || null,
        guidance_calories_min: macroNumber(guidanceForm.caloriesMin),
        guidance_calories_max: macroNumber(guidanceForm.caloriesMax),
        guidance_protein_min: macroNumber(guidanceForm.proteinMin),
        guidance_protein_max: macroNumber(guidanceForm.proteinMax),
        guidance_meal_image: guidanceForm.mealImage || null,
        guidance_meal_calories_max: macroNumber(guidanceForm.mealCaloriesMax),
        guidance_meal_protein_min: macroNumber(guidanceForm.mealProteinMin),
        guidance_meal_protein_max: macroNumber(guidanceForm.mealProteinMax),
        guidance_dinner_image: guidanceForm.dinnerImage || null,
        guidance_dinner_calories_max: macroNumber(guidanceForm.dinnerCaloriesMax),
        guidance_dinner_protein_min: macroNumber(guidanceForm.dinnerProteinMin),
        guidance_dinner_protein_max: macroNumber(guidanceForm.dinnerProteinMax),
        guidance_breakfast_image: guidanceForm.breakfastImage || null,
        guidance_breakfast_calories_max: macroNumber(guidanceForm.breakfastCaloriesMax),
        guidance_breakfast_protein_min: macroNumber(guidanceForm.breakfastProteinMin),
        guidance_breakfast_protein_max: macroNumber(guidanceForm.breakfastProteinMax),
      };
      const { error } = await supabase
        .from("recipes")
        .update({
          image_url: guidanceForm.lunchImage || guidanceRecipe.image_url,
          macros,
        })
        .eq("id", guidanceRecipe.id);
      if (error) throw error;
      await load();
      toast.success("Orientación actualizada en Snacks y Meriendas");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar la orientación");
    } finally {
      setSavingGuidance(false);
    }
  };

  const load = async () => {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .or("is_library.eq.true,and(is_library.eq.false,user_id.is.null,source_user_id.is.null)")
      .order("created_at", { ascending: false });
    if (error) {
      recordAppError({
        area: "supabase",
        action: "Cargar recetas oficiales en Administración",
        error,
        userMessage: "No se pudo cargar la lista de recetas oficiales.",
      });
      toast.error(error.message || "No se pudieron cargar las recetas oficiales");
      return [];
    }
    setItems((data ?? []) as RecipeRow[]);
    return (data ?? []) as RecipeRow[];
  };

  useEffect(() => { load(); }, []);

  const updateForm = (patch: Partial<LibForm>) => setForm(prev => ({ ...prev, ...patch }));

  const toggleQualityIssue = async (recipe: RecipeRow, issue: string) => {
    const ignored = new Set(ignoredRecipeQualityIssues(recipe));
    if (ignored.has(issue)) ignored.delete(issue);
    else ignored.add(issue);

    const nextMacros = {
      ...(recipe.macros ?? {}),
      quality_ignored: Array.from(ignored),
    };

    setChangingQualityId(`${recipe.id}:${issue}`);
    const { error } = await supabase
      .from("recipes")
      .update({ macros: nextMacros })
      .eq("id", recipe.id);
    setChangingQualityId(null);

    if (error) {
      toast.error(error.message || "No se pudo actualizar el control de calidad");
      return;
    }

    setItems(current => current.map(item =>
      item.id === recipe.id ? { ...item, macros: nextMacros } : item
    ));
    toast.success(ignored.has(issue) ? "Aviso marcado como no aplicable" : "Aviso reactivado");
  };

  const clearLocalDraft = () => {
    try {
      window.localStorage.removeItem(ADMIN_RECIPE_DRAFT_KEY);
    } catch {
      // El borrador local es una ayuda; si el navegador no permite borrarlo, no bloquea el guardado.
    }
    setAvailableDraft(null);
  };
  const rememberCategory = (category: string) => {
    if (category) window.localStorage.setItem(ADMIN_RECIPE_CATEGORY_KEY, category);
  };
  const resetForm = (category = form.category || filterCat || LIBRARY_CATEGORIES[0].id) => {
    clearLocalDraft();
    rememberCategory(category);
    setForm({ ...emptyForm, category });
    setEditingId(null);
    setMacroDebug([]);
    setLastMacroWarning("");
    setQuantityNotice("");
    setRecipeFormOpen(false);
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ADMIN_RECIPE_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as RecipeEditorDraft;
        if (draft?.form && formHasDraftContent(draft.form)) setAvailableDraft(draft);
      }
    } catch {
      window.localStorage.removeItem(ADMIN_RECIPE_DRAFT_KEY);
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (!formHasDraftContent(form)) return;
    const timeout = window.setTimeout(() => {
      try {
        const draft: RecipeEditorDraft = {
          editingId,
          form,
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(ADMIN_RECIPE_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Si el almacenamiento local está lleno o bloqueado, no debe impedir editar ni guardar.
      }
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [draftReady, editingId, form]);

  const recoverLocalDraft = () => {
    if (!availableDraft) return;
    setEditingId(availableDraft.editingId);
    setForm(availableDraft.form);
    setRecipeFormOpen(true);
    setMacroDebug([]);
    setLastMacroWarning("");
    setQuantityNotice("Borrador recuperado. No se guardará en la receta hasta que pulses “Guardar”.");
    setAvailableDraft(null);
    toast.success("Borrador recuperado");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("recipe-images").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      updateForm({ image_url: recipeImagePublicUrl(path) });
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
    if (editingId && !form.title.trim()) { toast.error("El nombre de la receta es obligatorio para guardar los macros"); return null; }
    if (editingId && !form.category) { toast.error("La categoría es obligatoria para guardar los macros"); return null; }
    const missingQty = ingredients.filter(line => !QTY_RE.test(line));
    if (missingQty.length) toast.warning(`Hay ingredientes sin gramos o cantidad clara: ${missingQty[0]}`);
    setCalculating(true);
    try {
      console.info("[admin-recipes] recalculando macros del formulario", {
        recipeId: editingId,
        ingredients,
        servings: Number(form.servings) || 1,
        category: form.category,
      });
      const data = await calculateWithMacroSpecialist({
        ingredientsText: form.ingredients,
        servings: Number(form.servings) || 1,
        category: form.category,
      });
      const calculatedMacros = applyMacros(data);

      if (editingId) {
        const payload = payloadFromForm(editingRecipe, calculatedMacros);
        console.info("[admin-recipes] guardando macros recalculados en receta oficial", {
          recipeId: editingId,
          title: payload.title,
          macros: payload.macros,
        });
        const { error } = await supabase
          .from("recipes")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        await load();
        toast.success("Macros recalculados y guardados en la receta oficial");
      }

      return calculatedMacros;
    } catch (err: any) {
      console.error("[admin-recipes] error recalculando macros del formulario", err);
      const message = err?.message || err?.details || "Error recalculando macros";
      setLastMacroWarning(`Error al recalcular macros: ${message}`);
      toast.error(message);
      return null;
    } finally {
      setCalculating(false);
    }
  };

  const completeQuantitiesForForm = async () => {
    const ingredients = parseLines(form.ingredients);
    if (!ingredients.length) { toast.error("Añade ingredientes antes de completar cantidades"); return; }
    setCompletingQuantities(true);
    setQuantityNotice("");
    try {
      const result = await completeRecipeQuantities({
        title: form.title,
        category: form.category,
        servings: form.servings || 1,
        ingredients,
        steps: parseLines(form.steps),
      });
      const completedText = result.ingredients.map(completedIngredientToLine).filter(Boolean).join("\n");
      updateForm({ ingredients: completedText, servings: String(result.servings || form.servings || "1") });
      const data = await calculateWithMacroSpecialist({
        ingredientsText: completedText,
        servings: Number(result.servings || form.servings) || 1,
        category: form.category,
      });
      applyMacros(data);
      setQuantityNotice(result.notice || "Cantidades estimadas automáticamente. Revísalas antes de guardar.");
      toast.success("Cantidades completadas. Revisa y guarda la receta.");
    } catch (err: any) {
      toast.error(err.message || "No se pudieron completar las cantidades");
    } finally {
      setCompletingQuantities(false);
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
      const activeCategory = form.category;
      resetForm(activeCategory);
      setFilterCat(activeCategory);
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
    setRecipeFormOpen(true);
    setMacroDebug([]);
    setLastMacroWarning("");
    setQuantityNotice("");
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
    setDeletingId(recipe.id);
    try {
      const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
      if (error) { toast.error(error.message); return; }
      if (editingId === recipe.id) resetForm();
      setRecipeToDelete(null);
      await load();
      toast.success("Receta eliminada");
    } finally {
      setDeletingId(null);
    }
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

  const changeRecipeCategory = async (recipe: RecipeRow, category: string) => {
    if (!category || category === recipe.category || changingCategoryId) return;
    setChangingCategoryId(recipe.id);
    try {
      const { data, error } = await supabase
        .from("recipes")
        .update({ category, categories: [category] })
        .eq("id", recipe.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No se encontró la receta para cambiar la categoría");
      setItems(current => current.map(item => item.id === recipe.id ? data as RecipeRow : item));
      if (editingId === recipe.id) updateForm({ category });
      toast.success("Categoría actualizada");
    } catch (err: any) {
      toast.error(err.message || "No se pudo cambiar la categoría");
    } finally {
      setChangingCategoryId(null);
    }
  };

  const orderedRecipesInCategory = (category: string | null | undefined) =>
    items
      .filter(item => (item.category ?? "") === (category ?? ""))
      .sort(compareRecipesByManualOrder);

  const moveRecipeWithinCategory = async (recipe: RecipeRow, direction: -1 | 1) => {
    const group = orderedRecipesInCategory(recipe.category);
    const currentIndex = group.findIndex(item => item.id === recipe.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= group.length) return;

    const reordered = [...group];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    const updates = reordered.map((item, index) => ({ id: item.id, sort_order: (index + 1) * 10 }));

    setItems(current => current.map(item => {
      const updated = updates.find(update => update.id === item.id);
      return updated ? { ...item, sort_order: updated.sort_order } : item;
    }));

    try {
      const results = await Promise.all(
        updates.map(update =>
          supabase
            .from("recipes")
            .update({ sort_order: update.sort_order } as any)
            .eq("id", update.id)
        )
      );
      const failed = results.find(result => result.error);
      if (failed?.error) throw failed.error;
      toast.success("Orden actualizado");
    } catch (err: any) {
      await load();
      const message = String(err?.message ?? "");
      if (message.toLowerCase().includes("sort_order")) {
        toast.error("Falta activar el orden de recetas en Supabase. No se ha borrado nada.");
      } else {
        toast.error(message || "No se pudo guardar el orden");
      }
    }
  };

  const visible = useMemo(() => {
    const term = String(query ?? "").trim().toLowerCase();
    return items.filter(item => {
      const matchesCategory = !filterCat || item.category === filterCat;
      const matchesSearch = !term || [item.title, item.description, item.category, ...(item.tags ?? [])]
        .filter(Boolean).join(" ").toLowerCase().includes(term);
      const issueCount = recipeQualityIssues(item).length;
      const matchesQuality = qualityFilter === "all" || (qualityFilter === "issues" ? issueCount > 0 : issueCount === 0);
      return matchesCategory && matchesSearch && matchesQuality;
    }).sort(compareRecipesByManualOrder);
  }, [items, filterCat, query, qualityFilter]);
  const displayedRecipes = visible.slice(0, visibleLimit);
  const qualityIssueCount = items.filter(item => recipeQualityIssues(item).length > 0).length;

  useEffect(() => {
    setVisibleLimit(RECIPES_PAGE_SIZE);
  }, [filterCat, query, qualityFilter]);

  return (
    <div className="admin-recipes-page pb-28">
      <AdminPageHeader title="Recetas oficiales" subtitle="Edita, duplica, recalcula y revisa las recetas visibles en la Biblioteca oficial." />

      {guidanceRecipe && (
        <details className="card-soft mb-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
            <div>
              <div className="font-medium">Tarjetas de orientación nutricional</div>
              <p className="mt-1 text-xs muted">Imágenes, calorías y proteínas de las tarjetas especiales.</p>
            </div>
            <span className="shrink-0 text-xs font-medium text-primary">Abrir / cerrar</span>
          </summary>
          <div className="space-y-4 px-4 pb-4">
            <div>
            <div className="font-medium">Orientación de Snacks y Meriendas</div>
            <p className="text-xs muted mt-1">
              Cambia aquí la imagen de cada categoría y los valores que aparecen en sus tarjetas de primera posición.
            </p>
            </div>

          <div className="grid grid-cols-2 gap-3">
            {([
              ["lunch", "Imagen de Snacks", guidanceForm.lunchImage],
              ["snack", "Imagen de Meriendas", guidanceForm.snackImage],
            ] as const).map(([side, label, image]) => (
              <div key={side} className="space-y-2">
                <div className="text-xs font-medium">{label}</div>
                <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                  {image && <img src={image} alt="" className="h-full w-full object-cover" />}
                </div>
                <label className="btn-ghost w-full cursor-pointer text-xs">
                  <Upload className="h-4 w-4" />
                  {uploadingGuidance === side ? "Subiendo…" : "Cambiar"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={Boolean(uploadingGuidance)}
                    onChange={event => uploadGuidanceImage(side, event)}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input className="field" aria-label="Calorías mínimas" placeholder="Kcal mínimas" value={guidanceForm.caloriesMin} onChange={event => setGuidanceForm(current => ({ ...current, caloriesMin: event.target.value }))} />
            <input className="field" aria-label="Calorías máximas" placeholder="Kcal máximas" value={guidanceForm.caloriesMax} onChange={event => setGuidanceForm(current => ({ ...current, caloriesMax: event.target.value }))} />
            <input className="field" aria-label="Proteínas mínimas" placeholder="Proteína mínima" value={guidanceForm.proteinMin} onChange={event => setGuidanceForm(current => ({ ...current, proteinMin: event.target.value }))} />
            <input className="field" aria-label="Proteínas máximas" placeholder="Proteína máxima" value={guidanceForm.proteinMax} onChange={event => setGuidanceForm(current => ({ ...current, proteinMax: event.target.value }))} />
          </div>

          <button type="button" className="btn-primary w-full" onClick={saveGuidance} disabled={savingGuidance || Boolean(uploadingGuidance)}>
            <Save className="h-4 w-4" />
            {savingGuidance ? "Guardando…" : "Guardar orientación"}
          </button>

          <div className="border-t border-border/70 pt-4">
            <div className="font-medium">Orientación de Comidas</div>
            <p className="text-xs muted mt-1">Esta tarjeta aparecerá la primera en Comidas.</p>
          </div>
          <div className="space-y-2">
            <div className="aspect-video overflow-hidden rounded-2xl bg-muted">
              {guidanceForm.mealImage && <img src={guidanceForm.mealImage} alt="" className="h-full w-full object-cover" />}
            </div>
            <label className="btn-ghost w-full cursor-pointer text-xs">
              <Upload className="h-4 w-4" />
              {uploadingGuidance === "meal" ? "Subiendo…" : "Cambiar imagen de Comidas"}
              <input type="file" accept="image/*" className="hidden" disabled={Boolean(uploadingGuidance)} onChange={event => uploadGuidanceImage("meal", event)} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className="field" aria-label="Calorías máximas de Comidas" placeholder="Kcal máximas" value={guidanceForm.mealCaloriesMax} onChange={event => setGuidanceForm(current => ({ ...current, mealCaloriesMax: event.target.value }))} />
            <input className="field" aria-label="Proteínas mínimas de Comidas" placeholder="Proteína mínima" value={guidanceForm.mealProteinMin} onChange={event => setGuidanceForm(current => ({ ...current, mealProteinMin: event.target.value }))} />
            <input className="field" aria-label="Proteínas máximas de Comidas" placeholder="Proteína máxima" value={guidanceForm.mealProteinMax} onChange={event => setGuidanceForm(current => ({ ...current, mealProteinMax: event.target.value }))} />
          </div>

          <div className="border-t border-border/70 pt-4">
            <div className="font-medium">Orientación de Cenas sin Herbalife</div>
            <p className="text-xs muted mt-1">Esta tarjeta aparecerá la primera en Cenas sin Herbalife.</p>
          </div>
          <div className="space-y-2">
            <div className="aspect-video overflow-hidden rounded-2xl bg-muted">
              {guidanceForm.dinnerImage && <img src={guidanceForm.dinnerImage} alt="" className="h-full w-full object-cover" />}
            </div>
            <label className="btn-ghost w-full cursor-pointer text-xs">
              <Upload className="h-4 w-4" />
              {uploadingGuidance === "dinner" ? "Subiendo…" : "Cambiar imagen de Cenas"}
              <input type="file" accept="image/*" className="hidden" disabled={Boolean(uploadingGuidance)} onChange={event => uploadGuidanceImage("dinner", event)} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className="field" aria-label="Calorías máximas de Cenas" placeholder="Kcal máximas" value={guidanceForm.dinnerCaloriesMax} onChange={event => setGuidanceForm(current => ({ ...current, dinnerCaloriesMax: event.target.value }))} />
            <input className="field" aria-label="Proteínas mínimas de Cenas" placeholder="Proteína mínima" value={guidanceForm.dinnerProteinMin} onChange={event => setGuidanceForm(current => ({ ...current, dinnerProteinMin: event.target.value }))} />
            <input className="field" aria-label="Proteínas máximas de Cenas" placeholder="Proteína máxima" value={guidanceForm.dinnerProteinMax} onChange={event => setGuidanceForm(current => ({ ...current, dinnerProteinMax: event.target.value }))} />
          </div>

          <button type="button" className="btn-primary w-full" onClick={saveGuidance} disabled={savingGuidance || Boolean(uploadingGuidance)}>
            <Save className="h-4 w-4" />
            {savingGuidance ? "Guardando…" : "Guardar todas las orientaciones"}
          </button>

          <div className="border-t border-border/70 pt-4">
            <div className="font-medium">Orientación de Desayunos sin Herbalife</div>
            <p className="text-xs muted mt-1">Cambia la imagen y los valores de la tarjeta especial de desayunos.</p>
          </div>
          <div className="space-y-2">
            <div className="aspect-video overflow-hidden rounded-2xl bg-muted">
              {guidanceForm.breakfastImage && <img src={guidanceForm.breakfastImage} alt="" className="h-full w-full object-cover" />}
            </div>
            <label className="btn-ghost w-full cursor-pointer text-xs">
              <Upload className="h-4 w-4" />
              {uploadingGuidance === "breakfast" ? "Subiendo…" : "Cambiar imagen de Desayunos"}
              <input type="file" accept="image/*" className="hidden" disabled={Boolean(uploadingGuidance)} onChange={event => uploadGuidanceImage("breakfast", event)} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className="field" aria-label="Calorías máximas de Desayunos" placeholder="Kcal máximas" value={guidanceForm.breakfastCaloriesMax} onChange={event => setGuidanceForm(current => ({ ...current, breakfastCaloriesMax: event.target.value }))} />
            <input className="field" aria-label="Proteínas mínimas de Desayunos" placeholder="Proteína mínima" value={guidanceForm.breakfastProteinMin} onChange={event => setGuidanceForm(current => ({ ...current, breakfastProteinMin: event.target.value }))} />
            <input className="field" aria-label="Proteínas máximas de Desayunos" placeholder="Proteína máxima" value={guidanceForm.breakfastProteinMax} onChange={event => setGuidanceForm(current => ({ ...current, breakfastProteinMax: event.target.value }))} />
          </div>

          <button type="button" className="btn-primary w-full" onClick={saveGuidance} disabled={savingGuidance || Boolean(uploadingGuidance)}>
            <Save className="h-4 w-4" />
            {savingGuidance ? "Guardando…" : "Guardar orientación de Desayunos"}
          </button>
          </div>
        </details>
      )}

      <details open={recipeFormOpen} className="card-soft mb-5">
        <summary
          className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 focus:outline-none focus-visible:outline-none focus-visible:text-primary"
          onClick={event => {
            event.preventDefault();
            setRecipeFormOpen(current => !current);
          }}
        >
          <div>
            <div className="font-medium">Crear o editar una receta</div>
            <p className="mt-1 text-xs muted">{editingId ? "Edición en curso" : "Formulario de recetas oficiales"}</p>
          </div>
          <span className="shrink-0 text-xs font-medium text-primary">Abrir / cerrar</span>
        </summary>
        <form onSubmit={submit} className="space-y-3 px-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-sm">{editingId ? "Editar receta oficial" : "Nueva receta oficial"}</div>
            <p className="text-xs muted mt-0.5">Guardar no recalcula macros automáticamente. Usa el botón “Recalcular macros” cuando quieras actualizar valores nutricionales.</p>
          </div>
          {editingId && (
            <button type="button" onClick={() => resetForm()} className="text-xs muted inline-flex items-center gap-1 shrink-0">
              <X className="h-3 w-3" /> Cancelar
            </button>
          )}
        </div>

        {availableDraft && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 p-3 text-xs space-y-2">
            <div>
              <strong>Hay un borrador sin guardar.</strong>{" "}
              {availableDraft.savedAt ? `Guardado localmente el ${new Date(availableDraft.savedAt).toLocaleString("es-ES")}.` : ""}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary py-2 text-xs" onClick={recoverLocalDraft}>
                Recuperar borrador
              </button>
              <button type="button" className="btn-secondary py-2 text-xs" onClick={clearLocalDraft}>
                Descartar borrador
              </button>
            </div>
            <p className="muted">No se publicará ni sobrescribirá ninguna receta hasta que pulses “Guardar”.</p>
          </div>
        )}

        <input className="field" placeholder="Nombre de la receta *" value={form.title} onChange={e => updateForm({ title: e.target.value })} required />
        <select className="field" value={form.category} onChange={e => {
          rememberCategory(e.target.value);
          updateForm({ category: e.target.value });
        }} required>
          {LIBRARY_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
        {editingRecipe && (() => {
          const categoryGroup = orderedRecipesInCategory(editingRecipe.category);
          const categoryIndex = categoryGroup.findIndex(item => item.id === editingRecipe.id);
          return (
            <div className="rounded-2xl border border-border/70 bg-white/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] muted">Orden en {getCategoryLabel(editingRecipe.category)}</div>
                  <div className="text-xs font-medium">Posición {categoryIndex >= 0 ? categoryIndex + 1 : "—"} de {categoryGroup.length}</div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    className="btn-ghost px-2 py-2 text-[11px]"
                    onClick={() => moveRecipeWithinCategory(editingRecipe, -1)}
                    disabled={categoryIndex <= 0}
                  >
                    <ArrowUp className="h-3.5 w-3.5" /> Subir
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-2 text-[11px]"
                    onClick={() => moveRecipeWithinCategory(editingRecipe, 1)}
                    disabled={categoryIndex < 0 || categoryIndex >= categoryGroup.length - 1}
                  >
                    <ArrowDown className="h-3.5 w-3.5" /> Bajar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
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
          <label className="btn-ghost admin-recipes-add-button w-full cursor-pointer">
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
          onChange={e => { setMacroDebug([]); setLastMacroWarning(""); setQuantityNotice(""); updateForm({ ingredients: e.target.value }); }}
        />
        {parseLines(form.ingredients).length > 0 && hasIncompleteIngredientLines(form.ingredients) && (
          <button
            type="button"
            onClick={completeQuantitiesForForm}
            disabled={completingQuantities || calculating || uploading || saving}
            className="btn-primary w-full"
          >
            <Sparkles className="h-4 w-4" />
            {completingQuantities ? "Completando cantidades…" : "Completar cantidades automáticamente"}
          </button>
        )}
        {quantityNotice && <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 p-3 text-xs">{quantityNotice}</div>}
        <textarea className="field min-h-28" placeholder="Preparación paso a paso, un paso por línea" value={form.steps} onChange={e => updateForm({ steps: e.target.value })} />
        <input className="field" placeholder="Etiquetas separadas por coma" value={form.tags} onChange={e => updateForm({ tags: e.target.value })} />

        <div className="grid grid-cols-5 gap-2">
          <input className="field text-center" aria-label="Calorías" placeholder="Kcal" value={form.calories} onChange={e => updateForm({ calories: e.target.value })} />
          <input className="field text-center" aria-label="Proteínas" placeholder="Prot" value={form.protein} onChange={e => updateForm({ protein: e.target.value })} />
          <input className="field text-center" aria-label="Hidratos" placeholder="Hidr" value={form.carbs} onChange={e => updateForm({ carbs: e.target.value })} />
          <input className="field text-center" aria-label="Grasas" placeholder="Grasa" value={form.fat} onChange={e => updateForm({ fat: e.target.value })} />
          <input className="field text-center" aria-label="Fibra" placeholder="Fibra" value={form.fiber} onChange={e => updateForm({ fiber: e.target.value })} />
        </div>

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
                  <div className="muted">Cantidad: {item.grams ?? "—"} g/ml · Estado: {item.status} · Fuente: {item.sourceLabel ?? item.source ?? "—"}</div>
                  <div className="muted">Coincidencia: {item.matchedAs ?? "No encontrada"}</div>
                  {item.rawNutrition && (
                    <pre className="mt-2 overflow-auto rounded-lg bg-secondary/70 p-2 text-[10px] text-muted-foreground">
                      {JSON.stringify(item.rawNutrition, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        <button className="btn-primary w-full" disabled={uploading || calculating || saving}>
          <Save className="h-4 w-4" /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear receta oficial"}
        </button>
        </form>
      </details>

      <details className="card-soft mb-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
          <div>
            <div className="font-medium">Buscar y filtrar recetas</div>
            <p className="mt-1 text-xs muted">{visible.length} {visible.length === 1 ? "receta disponible" : "recetas disponibles"}</p>
          </div>
          <span className="shrink-0 text-xs font-medium text-primary">Abrir / cerrar</span>
        </summary>
        <div className="space-y-2 px-3 pb-3">
          <input className="field" placeholder="Buscar receta oficial…" value={query} onChange={e => setQuery(e.target.value)} />
          <select className="field" value={filterCat} onChange={e => {
            setFilterCat(e.target.value);
            if (e.target.value) rememberCategory(e.target.value);
          }}>
            <option value="">Todas las categorías</option>
            {LIBRARY_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
          <select className="field" value={qualityFilter} onChange={e => setQualityFilter(e.target.value as QualityFilter)}>
            <option value="all">Todas: completas e incompletas</option>
            <option value="issues">Solo recetas con avisos</option>
            <option value="complete">Solo recetas completas</option>
          </select>
          <div className="flex items-center justify-between gap-3 px-1 text-xs">
            <span className="font-medium text-foreground">
              {visible.length} {visible.length === 1 ? "receta encontrada" : "recetas encontradas"}
            </span>
            {visible.length > displayedRecipes.length && (
              <span className="muted">Mostrando {displayedRecipes.length}</span>
            )}
          </div>
          <div className={`rounded-xl px-3 py-2 text-xs ${qualityIssueCount ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            {qualityIssueCount
              ? `${qualityIssueCount} ${qualityIssueCount === 1 ? "receta necesita" : "recetas necesitan"} revisión`
              : "Todas las recetas han superado el control de calidad"}
          </div>
        </div>
      </details>

      <div className="space-y-2">
        {displayedRecipes.map(recipe => {
          const status = recipeStatus(recipe);
          const imageUrl = normalizeRecipeImageUrl(recipe.image_url);
          const detectedQualityIssues = detectedRecipeQualityIssues(recipe);
          const allowsQualityReview = canReviewQualityIssues(recipe);
          const qualityIssues = allowsQualityReview ? recipeQualityIssues(recipe) : detectedQualityIssues;
          const ignoredQualityIssues = allowsQualityReview
            ? detectedQualityIssues.filter(issue => ignoredRecipeQualityIssues(recipe).includes(issue))
            : [];
          const categoryGroup = orderedRecipesInCategory(recipe.category);
          const categoryIndex = categoryGroup.findIndex(item => item.id === recipe.id);
          const isRecipeCardExpanded = Boolean(expandedRecipeIds[recipe.id]);
          return (
            <div key={recipe.id} className="card-soft p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                {imageUrl && <img src={imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate flex items-center gap-1">
                    {status === "featured" && <Star className="h-3 w-3 text-primary fill-primary" />}
                    {recipe.title}
                  </div>
                  <div className="text-xs muted truncate">
                    {getCategoryLabel(recipe.category)} · {recipe.macros?.protein ?? 0}g prot · {recipe.macros?.calories ?? 0} kcal · {status === "hidden" ? "Oculta" : status === "featured" ? "Destacada" : "Visible"}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-3 py-2 text-[11px]"
                  onClick={() => setExpandedRecipeIds(current => ({ ...current, [recipe.id]: !current[recipe.id] }))}
                >
                  {isRecipeCardExpanded ? "Cerrar" : "Abrir"}
                </button>
              </div>
              {!isRecipeCardExpanded && (
                <div className={`inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-medium ${qualityIssues.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {qualityIssues.length ? "Necesita revisión" : "Receta completa"}
                </div>
              )}
              <div className={`space-y-3 ${!isRecipeCardExpanded ? "hidden" : ""}`}>
              {qualityIssues.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {qualityIssues.map(issue => (
                    allowsQualityReview ? (
                      <button
                        key={issue}
                        type="button"
                        onClick={() => toggleQualityIssue(recipe, issue)}
                        disabled={changingQualityId === `${recipe.id}:${issue}`}
                        title="Pulsar para marcar como revisado"
                        className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                      >
                        {issue} · Revisar
                      </button>
                    ) : (
                      <span
                        key={issue}
                        className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700"
                      >
                        {issue}
                      </span>
                    )
                  ))}
                </div>
              ) : (
                <div className="inline-flex w-fit rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                  Receta completa
                </div>
              )}
              {ignoredQualityIssues.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>Revisados:</span>
                  {ignoredQualityIssues.map(issue => (
                    <button
                      key={issue}
                      type="button"
                      onClick={() => toggleQualityIssue(recipe, issue)}
                      disabled={changingQualityId === `${recipe.id}:${issue}`}
                      title="Pulsar para reactivar este aviso"
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-700 transition hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      ✓ Revisado: {issue}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-5 gap-1.5 text-center text-[11px]">
                <MiniMacro label="Kcal" value={recipe.macros?.calories ?? 0} />
                <MiniMacro label="Prot" value={`${recipe.macros?.protein ?? 0}g`} />
                <MiniMacro label="Hidr" value={`${recipe.macros?.carbs ?? 0}g`} />
                <MiniMacro label="Grasa" value={`${recipe.macros?.fat ?? 0}g`} />
                <MiniMacro label="Fibra" value={`${recipe.macros?.fiber ?? 0}g`} />
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-[11px]">
                <Link to={`/app/biblioteca/${recipe.id}`} state={{ recipeBackTo: "/app/admin/recetas" }} className="btn-ghost px-2 py-2"><Eye className="h-3.5 w-3.5" /> Ver</Link>
                <button type="button" onClick={() => startEdit(recipe)} className="btn-ghost px-2 py-2"><Sparkles className="h-3.5 w-3.5" /> Editar</button>
                <button type="button" onClick={() => duplicateRecipe(recipe)} className="btn-ghost px-2 py-2"><Copy className="h-3.5 w-3.5" /> Duplicar</button>
                <button type="button" onClick={() => recalculateRecipe(recipe)} disabled={calculating} className="btn-ghost px-2 py-2"><Calculator className="h-3.5 w-3.5" /> Macros</button>
                <button type="button" onClick={() => setRecipeToDelete(recipe)} className="btn-ghost px-2 py-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Eliminar</button>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/70 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] muted">Orden en {getCategoryLabel(recipe.category)}</div>
                    <div className="text-xs font-medium">Posición {categoryIndex >= 0 ? categoryIndex + 1 : "—"} de {categoryGroup.length}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      className="btn-ghost px-2 py-2 text-[11px]"
                      onClick={() => moveRecipeWithinCategory(recipe, -1)}
                      disabled={categoryIndex <= 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" /> Subir
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-2 text-[11px]"
                      onClick={() => moveRecipeWithinCategory(recipe, 1)}
                      disabled={categoryIndex < 0 || categoryIndex >= categoryGroup.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" /> Bajar
                    </button>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/70 p-2">
                <label className="text-[10px] muted block mb-1">Cambiar categoría</label>
                <select
                  className="field text-xs py-2"
                  value={recipe.category ?? ""}
                  onChange={e => changeRecipeCategory(recipe, e.target.value)}
                  disabled={changingCategoryId === recipe.id}
                >
                  {LIBRARY_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
                </select>
              </div>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && <div className="card-soft p-6 text-center muted">No hay recetas oficiales con este filtro.</div>}
        {displayedRecipes.length < visible.length && (
          <button
            type="button"
            className="btn-ghost w-full py-3"
            onClick={() => setVisibleLimit(limit => limit + RECIPES_PAGE_SIZE)}
          >
            Cargar más ({visible.length - displayedRecipes.length} restantes)
          </button>
        )}
      </div>

      {recipeToDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
          <div className="card-soft w-full max-w-sm p-5 shadow-xl">
            <div className="font-semibold text-lg mb-2">Eliminar receta oficial</div>
            <p className="text-sm text-foreground mb-1">{recipeToDelete.title}</p>
            <p className="text-sm muted mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setRecipeToDelete(null)}
                disabled={deletingId === recipeToDelete.id}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => deleteRecipe(recipeToDelete)}
                disabled={deletingId === recipeToDelete.id}
              >
                {deletingId === recipeToDelete.id ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
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
