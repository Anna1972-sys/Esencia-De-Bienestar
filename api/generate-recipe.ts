import { createClient } from "@supabase/supabase-js";
import { INITIAL_INTERNAL_FOODS } from "./internal-foods-data.js";

type RecipeCategory = "comidas_saludables" | "almuerzos" | "meriendas" | "nutricion_deportiva";

type GenerateBody = {
  category?: RecipeCategory;
  ingredients?: string[];
  preferences?: string;
  dislikes?: string;
  avoid?: string;
  servings?: number;
};

type InternalFoodContext = {
  name: string;
  synonyms: string[];
  category: string;
  base_quantity: number;
  base_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

type FoodItemContext = {
  id: string;
  source_type: string;
  nombre: string;
  nombre_normalizado: string;
  aliases: string[];
  categoria: string;
  estado: string;
  kcal_100g: number;
  proteina_100g: number;
  hidratos_100g: number;
  grasa_100g: number;
  fibra_100g: number;
};

type ProductContext = {
  name: string;
  aliases: string[];
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  measures: {
    name: string;
    grams: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    is_default: boolean;
  }[];
};

type RecipeResult = {
  title: string;
  description: string;
  category: RecipeCategory;
  servings: number;
  prep_time: number;
  ingredients: { name: string; quantity: string; grams: number }[];
  steps: string[];
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  nutrition_status: "verified" | "estimated";
  nutrition_note: "Valores nutricionales verificados" | "Valores nutricionales estimados";
  nutrition_reference: string;
  tags: string[];
};

const CATEGORIES: Record<RecipeCategory, { label: string; rules: string; maxCalories?: number; minCalories?: number; minProtein: number }> = {
  comidas_saludables: {
    label: "Comidas saludables",
    rules: "Entre 450 y 500 kcal por ración. Alta en proteína. Verduras como base. Fácil de cocinar. Puede usar productos propios disponibles para recetas si el usuario los incluye.",
    minCalories: 450,
    maxCalories: 500,
    minProtein: 28,
  },
  almuerzos: {
    label: "Almuerzos",
    rules: "Máximo 180 kcal por ración. Alto en proteína. Fácil de preparar y transportar. Puede usar productos propios disponibles para recetas si el usuario los incluye.",
    maxCalories: 180,
    minProtein: 12,
  },
  meriendas: {
    label: "Meriendas",
    rules: "Máximo 180 kcal por ración. Alta en proteína. Fácil de preparar. Puede usar productos propios disponibles para recetas si el usuario los incluye.",
    maxCalories: 180,
    minProtein: 12,
  },
  nutricion_deportiva: {
    label: "Nutrición deportiva",
    rules: "Orientada al aumento de masa muscular. Alta en proteína. Adaptada a los ingredientes disponibles. Sin límite fijo de calorías, pero con cantidades coherentes para el objetivo.",
    minProtein: 35,
  },
};

const EXPECTED_SUPABASE_REF = "vuvdnmessgwhlggzcfqb";
const EXPECTED_SUPABASE_HOST = `${EXPECTED_SUPABASE_REF}.supabase.co`;

function pickSupabaseUrl(...candidates: Array<string | undefined>) {
  const valid = candidates.filter((url): url is string => /^https:\/\//.test(url ?? ""));
  return valid.find(url => url.includes(EXPECTED_SUPABASE_HOST)) ?? valid[0] ?? "";
}

const SYSTEM_PROMPT = `Eres el motor nutricional de Esencia de Bienestar.
Generas recetas prácticas, realistas y seguras en español.
Debes responder SIEMPRE con JSON válido, sin markdown y sin texto adicional.
La receta debe usar como base los ingredientes disponibles del usuario. Puedes añadir básicos de despensa solo si son mínimos: agua, sal, pimienta, especias, limón o una cantidad pequeña de aceite.
No calcules calorías ni macros. El cálculo nutricional final lo hace otro módulo con bases de datos verificadas.
Si devuelves valores nutricionales, serán ignorados.
Todos los ingredientes deben incluir gramos exactos.
Estructura obligatoria:
{
  "title": "string",
  "description": "string",
  "category": "comidas_saludables | almuerzos | meriendas | nutricion_deportiva",
  "servings": number,
  "prep_time": number,
  "ingredients": [{"name":"string","quantity":"string","grams":number}],
  "steps": ["string"],
  "macros": {},
  "nutrition_status": "estimated",
  "nutrition_note": "Pendiente de cálculo nutricional por base interna",
  "nutrition_reference": "",
  "tags": ["string"]
}`;

function cleanIngredients(input: unknown): string[] {
  return Array.isArray(input)
    ? input.map(String).map(item => item.trim()).filter(Boolean).slice(0, 20)
    : [];
}

function normalizeName(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : 0;
}

const SYNC_STOP_WORDS = new Set(["de", "del", "la", "el", "los", "las", "en", "a", "al", "con", "y"]);
const NO_MACRO_SYNC_WORDS = new Set([
  "agua",
  "sal",
  "pimienta",
  "especia",
  "especias",
  "hierba",
  "hierbas",
  "perejil",
  "oregano",
  "orégano",
  "tomillo",
  "romero",
  "albahaca",
]);

function syncTokens(value: unknown) {
  return normalizeName(value)
    .split(" ")
    .map(token => token.trim())
    .filter(token => token.length > 1 && !SYNC_STOP_WORDS.has(token));
}

function isNoMacroSyncIngredient(value: unknown) {
  const tokens = syncTokens(value);
  return tokens.length > 0 && tokens.every(token => NO_MACRO_SYNC_WORDS.has(token));
}

function syncIngredientGroup(value: unknown) {
  const normalized = normalizeName(value);
  if (!normalized) return null;
  if (/\b(caldo|broth|stock)\b/.test(normalized)) return "broth";
  if (/\b(ternera|vacuno|pollo|pavo|carne|filete)\b/.test(normalized)) return "meat";
  if (/\b(champiñon|champiñones|champinon|champinones|seta|setas|hongo|hongos)\b/.test(normalized)) return "mushroom";
  if (/\b(cebolla|tomate|calabacin|calabacín|zanahoria|verdura|verduras)\b/.test(normalized)) return "vegetable";
  if (/\b(ajo|pimienta|especia|especias)\b/.test(normalized)) return "seasoning";
  if (/\b(maicena|almidon|almidón|fecula|fécula|arroz|patata|papa)\b/.test(normalized)) return "starch";
  if (/\b(aceite|oliva)\b/.test(normalized)) return "oil";
  if (/\b(vino|vinagre|agua)\b/.test(normalized)) return "liquid";
  return null;
}

function containsWholeNormalizedPhrase(container: string, phrase: string) {
  if (!container || !phrase) return false;
  const phrasePattern = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|\\s)${phrasePattern}($|\\s)`).test(container);
}

function quantityToSyncGrams(quantity: number, unit: string, name: string) {
  const normalizedUnit = normalizeName(unit);
  const normalizedName = normalizeName(name);
  if (["g", "gr", "gramos"].includes(normalizedUnit)) return quantity;
  if (["ml", "mililitros"].includes(normalizedUnit)) return quantity;
  if (["cucharadita", "cucharaditas", "cdta", "cdtas"].includes(normalizedUnit)) {
    if (normalizedName.includes("aceite")) return quantity * 4.5;
    return quantity * 5;
  }
  if (["cucharada", "cucharadas", "cda", "cdas"].includes(normalizedUnit)) {
    if (normalizedName.includes("aceite")) return quantity * 13.5;
    return quantity * 10;
  }
  if (["diente", "dientes"].includes(normalizedUnit) && normalizedName.includes("ajo")) return quantity * 4;
  return quantity;
}

function parseSourceIngredientForSync(value: unknown): { name: string; quantity: string; grams: number; raw: string } | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const quantityPattern = /(\d+(?:[,.]\d+)?)\s*(g|gr|gramos|ml|mililitros|cucharada|cucharadas|cda|cdas|cucharadita|cucharaditas|cdta|cdtas|diente|dientes)\b/i;
  const quantityMatch = raw.match(quantityPattern);
  if (!quantityMatch) return null;
  const quantity = Number(quantityMatch[1].replace(",", "."));
  const unit = quantityMatch[2].trim();
  const name = raw
    .replace(quantityPattern, " ")
    .replace(/^\s*(de|del|la|el)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || isNoMacroSyncIngredient(name)) return null;
  return {
    name,
    quantity: `${quantityMatch[1].replace(",", ".")} ${unit}`,
    grams: numberOrZero(quantityToSyncGrams(quantity, unit, name)),
    raw,
  };
}

function ingredientNamesOverlap(left: unknown, right: unknown) {
  const leftNormalized = normalizeName(left);
  const rightNormalized = normalizeName(right);
  if (!leftNormalized || !rightNormalized) return false;
  if (leftNormalized === rightNormalized) return true;
  const leftGroup = syncIngredientGroup(leftNormalized);
  const rightGroup = syncIngredientGroup(rightNormalized);
  if (leftGroup && rightGroup && leftGroup !== rightGroup) return false;
  if (containsWholeNormalizedPhrase(leftNormalized, rightNormalized) || containsWholeNormalizedPhrase(rightNormalized, leftNormalized)) return true;
  const leftTokens = syncTokens(leftNormalized);
  const rightTokens = syncTokens(rightNormalized);
  if (!leftTokens.length || !rightTokens.length) return false;
  const overlap = leftTokens.filter(token => rightTokens.includes(token)).length;
  return overlap >= Math.min(2, Math.min(leftTokens.length, rightTokens.length)) || (overlap >= 1 && Math.min(leftTokens.length, rightTokens.length) === 1);
}

function preparationMentionsIngredient(steps: string[], ingredientName: string) {
  const normalizedSteps = normalizeName(steps.join(" "));
  if (!normalizedSteps) return false;
  const normalizedIngredient = normalizeName(ingredientName);
  if (normalizedIngredient && normalizedSteps.includes(normalizedIngredient)) return true;
  const tokens = syncTokens(ingredientName);
  return tokens.some(token => normalizedSteps.includes(token));
}

function syncRecipeIngredientsWithPreparation(recipe: RecipeResult, sourceIngredients: string[]): RecipeResult {
  const missingIngredients = sourceIngredients
    .map(parseSourceIngredientForSync)
    .filter((item): item is { name: string; quantity: string; grams: number; raw: string } => Boolean(item))
    .filter(item => preparationMentionsIngredient(recipe.steps, item.name))
    .filter(item => !recipe.ingredients.some(existing => ingredientNamesOverlap(existing.name, item.name)));

  if (missingIngredients.length === 0) return recipe;

  return {
    ...recipe,
    ingredients: [
      ...recipe.ingredients,
      ...missingIngredients.map(item => ({
        name: item.name,
        quantity: item.quantity,
        grams: item.grams,
      })),
    ],
  };
}

function numericValueIsPresent(value: unknown) {
  if (value === null || value === undefined || value === "") return false;
  const n = Number(value);
  return Number.isFinite(n);
}

function hasCompleteProductNutrition(product: any) {
  if (product?.verification_status !== "verificado") return false;
  return [product?.calories, product?.protein, product?.carbs, product?.fat, product?.fiber].every(numericValueIsPresent);
}

function hasCompleteMeasureNutrition(measure: any) {
  if (measure?.verification_status !== "verificado") return false;
  return [measure?.grams, measure?.calories, measure?.protein, measure?.carbs, measure?.fat, measure?.fiber].every(numericValueIsPresent);
}

function matchesInternalFood(input: string, food: InternalFoodContext) {
  const normalizedInput = normalizeName(input);
  const names = [food.name, ...(food.synonyms ?? [])].map(normalizeName).filter(Boolean);
  return names.some(name => normalizedInput === name || normalizedInput.includes(name) || name.includes(normalizedInput));
}

function matchesFoodItem(input: string, food: FoodItemContext) {
  const normalizedInput = normalizeName(input);
  const names = [food.nombre, food.nombre_normalizado, ...(food.aliases ?? [])].map(normalizeName).filter(Boolean);
  return names.some(name => normalizedInput === name || normalizedInput.includes(name) || name.includes(normalizedInput));
}

function matchesProduct(input: string, product: ProductContext) {
  const normalizedInput = normalizeName(input);
  const normalizedProduct = normalizeName(product.name);
  const normalizedAliases = (product.aliases ?? []).map(normalizeName).filter(Boolean);
  return Boolean(normalizedInput && normalizedProduct && (
    normalizedInput === normalizedProduct ||
    normalizedInput.includes(normalizedProduct) ||
    normalizedProduct.includes(normalizedInput) ||
    normalizedAliases.some(alias => normalizedInput.includes(alias) || alias.includes(normalizedInput))
  ));
}

function foodItemToInternalContext(food: FoodItemContext): InternalFoodContext {
  return {
    name: food.nombre,
    synonyms: food.aliases ?? [],
    category: food.categoria,
    base_quantity: 100,
    base_unit: "g",
    calories: numberOrZero(food.kcal_100g),
    protein: numberOrZero(food.proteina_100g),
    carbs: numberOrZero(food.hidratos_100g),
    fat: numberOrZero(food.grasa_100g),
    fiber: numberOrZero(food.fibra_100g),
  };
}

async function loadInternalFoodsForIngredients(authHeader: string | undefined, ingredients: string[]) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || ingredients.length === 0) return [];

  const supabaseUrl = pickSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return [];

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await (supabase as any)
    .schema("public")
    .from("internal_foods")
    .select("name,synonyms,category,base_quantity,base_unit,calories,protein,carbs,fat,fiber")
    .eq("is_active", true);

  if (error || !Array.isArray(data)) {
    return INITIAL_INTERNAL_FOODS
      .filter(food => ingredients.some(ingredient => matchesInternalFood(ingredient, food)))
      .slice(0, 20);
  }

  return (data as InternalFoodContext[])
    .filter(food => ingredients.some(ingredient => matchesInternalFood(ingredient, food)))
    .slice(0, 20)
    .map(food => ({
      name: food.name,
      synonyms: food.synonyms ?? [],
      category: food.category,
      base_quantity: Number(food.base_quantity) || 100,
      base_unit: food.base_unit,
      calories: numberOrZero(food.calories),
      protein: numberOrZero(food.protein),
      carbs: numberOrZero(food.carbs),
      fat: numberOrZero(food.fat),
      fiber: numberOrZero(food.fiber),
    }));
}

async function loadFoodItemsForIngredients(authHeader: string | undefined, ingredients: string[]) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || ingredients.length === 0) return [];

  const supabaseUrl = pickSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return [];

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await (supabase as any)
    .schema("public")
    .from("food_items")
    .select("id,source_type,nombre,nombre_normalizado,aliases,categoria,estado,kcal_100g,proteina_100g,hidratos_100g,grasa_100g,fibra_100g")
    .eq("is_active", true)
    .eq("verificado", true);

  if (error || !Array.isArray(data)) return [];

  return (data as FoodItemContext[])
    .filter(food => ingredients.some(ingredient => matchesFoodItem(ingredient, food)))
    .slice(0, 20)
    .map(foodItemToInternalContext);
}

async function loadRecognizedFoodsForIngredients(authHeader: string | undefined, ingredients: string[]) {
  const internalFoods = await loadInternalFoodsForIngredients(authHeader, ingredients);
  const matchedIngredients = new Set(
    ingredients
      .filter(ingredient => internalFoods.some(food => matchesInternalFood(ingredient, food)))
      .map(normalizeName),
  );
  const missingIngredients = ingredients.filter(ingredient => !matchedIngredients.has(normalizeName(ingredient)));

  if (missingIngredients.length === 0) return internalFoods;

  const fallbackFoods = await loadFoodItemsForIngredients(authHeader, missingIngredients);
  const existingNames = new Set(internalFoods.map(food => normalizeName(food.name)));
  const mergedFallback = fallbackFoods.filter(food => !existingNames.has(normalizeName(food.name)));
  return [...internalFoods, ...mergedFallback].slice(0, 20);
}

async function loadProductsForIngredients(authHeader: string | undefined, ingredients: string[]) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || ingredients.length === 0) return [];

  const supabaseUrl = pickSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return [];

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await (supabase as any)
    .schema("public")
    .from("products")
    .select("name,aliases,verification_status,calories,protein,carbs,fat,fiber,product_measures(name,grams,calories,protein,carbs,fat,fiber,verification_status,is_default),product_categories(name)")
    .eq("is_active", true)
    .eq("available_for_recipes", true)
    .eq("informative_only", false);

  if (error || !Array.isArray(data)) return [];

  return data
    .filter((product: any) => hasCompleteProductNutrition(product) || (product.product_measures ?? []).some(hasCompleteMeasureNutrition))
    .map((product: any) => ({
      name: String(product.name ?? ""),
      aliases: Array.isArray(product.aliases) ? product.aliases.map(String).filter(Boolean) : [],
      category: String(product.product_categories?.name ?? "Productos"),
      calories: numberOrZero(product.calories),
      protein: numberOrZero(product.protein),
      carbs: numberOrZero(product.carbs),
      fat: numberOrZero(product.fat),
      fiber: numberOrZero(product.fiber),
      measures: Array.isArray(product.product_measures)
        ? product.product_measures.filter(hasCompleteMeasureNutrition).map((measure: any) => ({
          name: String(measure.name ?? ""),
          grams: numberOrZero(measure.grams),
          calories: numberOrZero(measure.calories),
          protein: numberOrZero(measure.protein),
          carbs: numberOrZero(measure.carbs),
          fat: numberOrZero(measure.fat),
          fiber: numberOrZero(measure.fiber),
          is_default: Boolean(measure.is_default),
        }))
        : [],
    }))
    .filter((product: ProductContext) => product.name && ingredients.some(ingredient => matchesProduct(ingredient, product)))
    .slice(0, 20);
}

function normalizeRecipe(raw: any, category: RecipeCategory, servings: number, sourceIngredients: string[] = []): RecipeResult {
  const recipe = {
    title: String(raw?.title || "Receta Esencia").trim(),
    description: String(raw?.description || "Receta generada con tus ingredientes.").trim(),
    category,
    servings,
    prep_time: Math.max(1, Math.round(numberOrZero(raw?.prep_time) || 20)),
    ingredients: Array.isArray(raw?.ingredients)
      ? raw.ingredients.map((item: any) => ({
        name: String(item?.name ?? item ?? "").trim(),
        quantity: String(item?.quantity ?? "").trim(),
        grams: numberOrZero(item?.grams),
      })).filter((item: any) => item.name)
      : [],
    steps: Array.isArray(raw?.steps) ? raw.steps.map(String).map(s => s.trim()).filter(Boolean) : [],
    macros: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    },
    nutrition_status: "estimated" as const,
    nutrition_note: "Valores nutricionales estimados" as const,
    nutrition_reference: "",
    tags: Array.isArray(raw?.tags) ? raw.tags.map(String).map(t => t.trim()).filter(Boolean).slice(0, 8) : [],
  };

  return syncRecipeIngredientsWithPreparation(recipe, sourceIngredients);
}

function validateRecipe(recipe: RecipeResult): string[] {
  const issues: string[] = [];

  if (!recipe.title || recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    issues.push("La receta debe incluir nombre, ingredientes y preparación completa.");
  }
  return issues;
}

function buildUserPrompt(
  body: Required<Pick<GenerateBody, "category" | "ingredients" | "servings">> & Omit<GenerateBody, "category" | "ingredients" | "servings">,
  issues: string[] = [],
  internalFoods: InternalFoodContext[] = [],
  products: ProductContext[] = [],
): string {
  const category = CATEGORIES[body.category];
  return JSON.stringify({
    tarea: "Genera una receta para el Generador IA de Esencia de Bienestar.",
    categoria: body.category,
    nombre_categoria: category.label,
    reglas_obligatorias: category.rules,
    ingredientes_disponibles: body.ingredients,
    productos_propios_reconocidos: products,
    alimentos_internos_reconocidos: internalFoods,
    preferencias_personales: body.preferences || "Sin preferencias adicionales.",
    alimentos_que_no_gustan: body.dislikes || "No indicado.",
    alimentos_a_evitar: body.avoid || "No indicado.",
    raciones: body.servings,
    validacion_previa_a_corregir: issues,
    instrucciones: [
      "Devuelve solo JSON válido con la estructura obligatoria.",
      "Ajusta gramos y cantidades culinarias antes de responder para cumplir las reglas de la categoría.",
      "No calcules calorías, proteínas, hidratos, grasas, fibra ni sal.",
      "Deja macros vacío o con ceros; el cálculo nutricional lo hace el sistema después.",
      "Si un ingrediente coincide con productos_propios_reconocidos, úsalo como referencia prioritaria y conserva su nombre de forma reconocible para que el recalculador use la base oficial de productos.",
      "Si un producto propio tiene medidas habituales, puedes usar esas medidas exactas en quantity y grams.",
      "Si un ingrediente coincide con alimentos_internos_reconocidos por nombre o sinónimo, usa ese alimento interno como referencia principal y conserva su nombre de forma reconocible.",
      "Todo ingrediente que menciones en la preparación debe aparecer también en ingredients con su cantidad exacta.",
      "Nunca presentes valores nutricionales como verificados.",
    ],
  });
}

async function callGemini(apiKey: string, prompt: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.35,
        },
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini ${response.status}: ${text.slice(0, 1200)}`);
    }

    const payload = JSON.parse(text);
    const content = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text ?? "").join("") ?? "";
    if (!content) throw new Error("Gemini no devolvió contenido");

    try {
      return JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Gemini no devolvió JSON válido");
      return JSON.parse(match[0]);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function getFriendlyGeminiError(err: any) {
  const raw = String(err?.message || "");
  const lower = raw.toLowerCase();

  if (lower.includes("429") || lower.includes("quota") || lower.includes("resource_exhausted")) {
    return "El generador gratuito no está disponible temporalmente. Inténtalo de nuevo más tarde.";
  }

  if (err?.name === "AbortError") {
    return "La generación ha tardado demasiado. Inténtalo de nuevo.";
  }

  return "El generador gratuito no está disponible temporalmente. Inténtalo de nuevo más tarde.";
}

async function verifySupabaseSession(authHeader: string | undefined) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Debes iniciar sesión para generar recetas" };

  const supabaseUrl = pickSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 500, error: "La conexión con Supabase no está configurada en este despliegue" };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { ok: false, status: 401, error: "Sesión no válida. Vuelve a iniciar sesión." };
  }

  return { ok: true, status: 200, error: "", token };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const session = await verifySupabaseSession(req.headers.authorization);
  if (!session.ok) {
    return res.status(session.status).json({ error: session.error });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "El generador gratuito no está disponible temporalmente. Inténtalo de nuevo más tarde." });
  }

  const body = (req.body ?? {}) as GenerateBody;
  const category = body.category && CATEGORIES[body.category] ? body.category : "comidas_saludables";
  const ingredients = cleanIngredients(body.ingredients);
  const servings = Math.max(1, Math.min(8, Math.round(Number(body.servings) || 1)));

  if (ingredients.length === 0) {
    return res.status(400).json({ error: "Añade al menos un ingrediente" });
  }

  const requestBody = {
    category,
    ingredients,
    servings,
    preferences: body.preferences,
    dislikes: body.dislikes,
    avoid: body.avoid,
  };
  const internalFoods = await loadRecognizedFoodsForIngredients(req.headers.authorization, ingredients);
  const products = await loadProductsForIngredients(req.headers.authorization, ingredients);

  let issues: string[] = [];

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const raw = await callGemini(apiKey, buildUserPrompt(requestBody, issues, internalFoods, products));
      const recipe = normalizeRecipe(raw, category, servings, ingredients);
      issues = validateRecipe(recipe);

      if (issues.length === 0) {
        return res.status(200).json({ result: recipe });
      }
    }

    return res.status(422).json({
      error: `No se pudo generar una receta que cumpla las reglas de ${CATEGORIES[category].label}. Prueba con algún ingrediente más.`,
      validation_issues: issues,
    });
  } catch (err: any) {
    return res.status(500).json({ error: getFriendlyGeminiError(err) });
  }
}
