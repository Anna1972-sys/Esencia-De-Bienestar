import { createClient } from "@supabase/supabase-js";

type RecipeCategory = "comidas_saludables" | "almuerzos" | "meriendas" | "nutricion_deportiva";

type GenerateBody = {
  category?: RecipeCategory;
  ingredients?: string[];
  preferences?: string;
  dislikes?: string;
  avoid?: string;
  servings?: number;
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
    rules: "Sin productos Herbalife. Entre 450 y 500 kcal por ración. Alta en proteína. Verduras como base. Fácil de cocinar.",
    minCalories: 450,
    maxCalories: 500,
    minProtein: 28,
  },
  almuerzos: {
    label: "Almuerzos",
    rules: "Sin productos Herbalife. Máximo 180 kcal por ración. Alto en proteína. Fácil de preparar y transportar.",
    maxCalories: 180,
    minProtein: 12,
  },
  meriendas: {
    label: "Meriendas",
    rules: "Sin productos Herbalife. Máximo 180 kcal por ración. Alta en proteína. Fácil de preparar.",
    maxCalories: 180,
    minProtein: 12,
  },
  nutricion_deportiva: {
    label: "Nutrición deportiva",
    rules: "Orientada al aumento de masa muscular. Alta en proteína. Adaptada a los ingredientes disponibles. Sin límite fijo de calorías, pero con cantidades coherentes para el objetivo.",
    minProtein: 35,
  },
};

const SYSTEM_PROMPT = `Eres el motor nutricional de Esencia de Bienestar.
Generas recetas prácticas, realistas y seguras en español.
Debes responder SIEMPRE con JSON válido, sin markdown y sin texto adicional.
La receta debe usar como base los ingredientes disponibles del usuario. Puedes añadir básicos de despensa solo si son mínimos: agua, sal, pimienta, especias, limón o una cantidad pequeña de aceite.
No inventes valores exactos como verificados si no hay una referencia nutricional suficiente. En ese caso usa nutrition_status="estimated" y nutrition_note="Valores nutricionales estimados".
Si usas una referencia nutricional general fiable, indica nutrition_status="verified", nutrition_note="Valores nutricionales verificados" y una referencia breve.
Los macros son por ración, no totales.
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
  "macros": {"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number},
  "nutrition_status": "verified | estimated",
  "nutrition_note": "Valores nutricionales verificados | Valores nutricionales estimados",
  "nutrition_reference": "string",
  "tags": ["string"]
}`;

function cleanIngredients(input: unknown): string[] {
  return Array.isArray(input)
    ? input.map(String).map(item => item.trim()).filter(Boolean).slice(0, 20)
    : [];
}

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : 0;
}

function normalizeRecipe(raw: any, category: RecipeCategory, servings: number): RecipeResult {
  const macros = raw?.macros ?? {};
  const nutritionStatus = raw?.nutrition_status === "verified" ? "verified" : "estimated";

  return {
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
      calories: numberOrZero(macros.calories),
      protein: numberOrZero(macros.protein),
      carbs: numberOrZero(macros.carbs),
      fat: numberOrZero(macros.fat),
      fiber: numberOrZero(macros.fiber),
    },
    nutrition_status: nutritionStatus,
    nutrition_note: nutritionStatus === "verified" ? "Valores nutricionales verificados" : "Valores nutricionales estimados",
    nutrition_reference: String(raw?.nutrition_reference || "").trim(),
    tags: Array.isArray(raw?.tags) ? raw.tags.map(String).map(t => t.trim()).filter(Boolean).slice(0, 8) : [],
  };
}

function validateRecipe(recipe: RecipeResult): string[] {
  const category = CATEGORIES[recipe.category];
  const issues: string[] = [];
  const calories = Number(recipe.macros.calories);
  const protein = Number(recipe.macros.protein);
  const serialized = JSON.stringify(recipe).toLowerCase();

  if (!recipe.title || recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    issues.push("La receta debe incluir nombre, ingredientes y preparación completa.");
  }
  if (!calories) {
    issues.push("Debe incluir calorías por ración.");
  }
  if (category.minCalories && calories < category.minCalories) {
    issues.push(`Debe ajustar cantidades para llegar al menos a ${category.minCalories} kcal por ración.`);
  }
  if (category.maxCalories && calories > category.maxCalories) {
    issues.push(`No puede superar ${category.maxCalories} kcal por ración.`);
  }
  if (protein < category.minProtein) {
    issues.push(`Debe subir la proteína por ración hasta al menos ${category.minProtein} g si es posible con los ingredientes disponibles.`);
  }
  if (recipe.category !== "nutricion_deportiva" && /herbalife|h24|formula 1|prolong|rebuild|restore|cr7/.test(serialized)) {
    issues.push("Esta categoría no puede incluir productos Herbalife ni H24.");
  }

  return issues;
}

function buildUserPrompt(body: Required<Pick<GenerateBody, "category" | "ingredients" | "servings">> & Omit<GenerateBody, "category" | "ingredients" | "servings">, issues: string[] = []): string {
  const category = CATEGORIES[body.category];
  return JSON.stringify({
    tarea: "Genera una receta para el Generador IA de Esencia de Bienestar.",
    categoria: body.category,
    nombre_categoria: category.label,
    reglas_obligatorias: category.rules,
    ingredientes_disponibles: body.ingredients,
    preferencias_personales: body.preferences || "Sin preferencias adicionales.",
    alimentos_que_no_gustan: body.dislikes || "No indicado.",
    alimentos_a_evitar: body.avoid || "No indicado.",
    raciones: body.servings,
    validacion_previa_a_corregir: issues,
    instrucciones: [
      "Devuelve solo JSON válido con la estructura obligatoria.",
      "Ajusta gramos y cantidades antes de responder para cumplir las reglas.",
      "Calcula macros por ración.",
      "Nunca presentes valores estimados como exactos.",
      "Si no hay referencia nutricional suficiente, usa Valores nutricionales estimados.",
    ],
  });
}

async function callOpenAI(apiKey: string, prompt: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${text.slice(0, 1200)}`);
    }

    const payload = JSON.parse(text);
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI no devolvió contenido");
    return JSON.parse(content);
  } finally {
    clearTimeout(timeout);
  }
}

async function verifySupabaseSession(authHeader: string | undefined) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Debes iniciar sesión para generar recetas" };

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 500, error: "La conexión con Supabase no está configurada en este despliegue" };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { ok: false, status: 401, error: "Sesión no válida. Vuelve a iniciar sesión." };
  }

  return { ok: true, status: 200, error: "" };
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY no está configurada en Vercel" });
  }

  const body = (req.body ?? {}) as GenerateBody;
  const category = body.category && CATEGORIES[body.category] ? body.category : "comidas_saludables";
  const ingredients = cleanIngredients(body.ingredients);
  const servings = Math.max(1, Math.min(8, Math.round(Number(body.servings) || 2)));

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

  let issues: string[] = [];

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const raw = await callOpenAI(apiKey, buildUserPrompt(requestBody, issues));
      const recipe = normalizeRecipe(raw, category, servings);
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
    const message = err?.name === "AbortError"
      ? "La generación ha tardado demasiado. Inténtalo de nuevo."
      : err?.message || "Error generando receta";
    return res.status(500).json({ error: message });
  }
}
