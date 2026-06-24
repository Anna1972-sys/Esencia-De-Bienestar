import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReqBody {
  mode: "ingredients" | "preferences" | "monthly";
  ingredients: string[];
  servings?: number;
  preferences?: {
    highProtein?: boolean;
    lowCalorie?: boolean;
    targetCalories?: number;
    allergies?: string;
    mealType?: string;
    maxTime?: number;
  };
}

function buildPrompt(body: ReqBody): string {
  const ing = body.ingredients.join(", ");
  const p = body.preferences || {};
  const prefs: string[] = [];
  if (p.highProtein) prefs.push("ALTA en proteína (mínimo 25g por porción)");
  if (p.lowCalorie) prefs.push("BAJA en calorías (máximo 450 kcal por porción) y BAJA en grasas (máximo 12g de grasa por porción), apta para procesos de pérdida de grasa y definición");
  if (p.targetCalories) prefs.push(`alrededor de ${p.targetCalories} kcal por porción`);
  if (p.allergies) prefs.push(`evitar alérgenos: ${p.allergies}`);
  if (p.mealType) prefs.push(`tipo de comida: ${p.mealType}`);
  if (p.maxTime) prefs.push(`máximo ${p.maxTime} minutos de preparación`);

  const base = `Eres nutricionista especializada en bienestar y pérdida de grasa saludable, dirigida tanto a hombres como a mujeres. Usa lenguaje inclusivo y neutro. Crea recetas claras, prácticas, deliciosas, altas en proteína y bajas en calorías y grasas cuando se indique.

REGLAS DE RACIONES Y CANTIDADES (OBLIGATORIAS):
- Genera SIEMPRE exactamente 2 raciones. "servings" DEBE ser 2.
- Usa únicamente las cantidades explícitas aportadas por la persona usuaria. No inventes pesos, volúmenes, unidades ni ingredientes.
- Si falta una cantidad necesaria para calcular la receta o su nutrición, devuelve {"error":"missing_quantities"} como JSON y no continúes.
- Cada ingrediente debe conservar una cantidad exacta en g, ml o unidades cuando corresponda.

REGLAS DE INGREDIENTES OBLIGATORIAS:
- La receta DEBE utilizar EXCLUSIVAMENTE los ingredientes proporcionados por la usuaria.
- NO añadas claras de huevo, leche, yogur, proteína en polvo, ni ningún otro alimento para aumentar artificialmente la proteína.
- NO añadas ningún ingrediente principal adicional (proteínas, verduras, frutas, lácteos, cereales, legumbres, grasas, etc.) que no esté en la lista del usuario.
- Si la usuaria no indica cantidades, utiliza porciones estándar saludables para una persona.
- Únicos extras permitidos (solo si son necesarios para la elaboración):
  · agua
  · sal
  · pimienta
  · ajo fresco o ajo en polvo
  · cebolla en polvo
  · pimentón
  · curry
  · cúrcuma
  · orégano
  · albahaca
  · perejil
  · romero
  · tomillo
  · especias y hierbas aromáticas en general
  · hasta 5 ml de aceite de oliva virgen extra (≈ 4.5 g, 0 g proteína, 0 g carbo, 4.5 g grasa, 40 kcal)
- NO inventes ingredientes nuevos salvo los permitidos arriba.

REGLAS NUTRICIONALES OBLIGATORIAS (calcula macros con RIGOR usando bases de datos nutricionales estándar tipo USDA/BEDCA):
- Usa solo datos trazables de USDA FoodData Central o AESAN/BEDCA. Declara la fuente concreta en "nutrition_reference".
- Calcula fibra, además de calorías, proteínas, carbohidratos y grasas.
- "macros" contiene valores POR RACIÓN (1 persona); "total_macros" contiene la suma de las 2 raciones.
- Si no puedes verificar todos los ingredientes con una fuente real, devuelve "nutrition_status":"unavailable", deja "macros" y "total_macros" vacíos y explica el motivo en "nutrition_note". Nunca inventes valores.
- Calcula proteína, carbohidratos y grasa de CADA ingrediente según su cantidad real, y luego SUMA todos los valores para obtener los macros totales por porción (dividiendo por el número de porciones).
- Las referencias nutricionales que siguen son SOLO para calcular cuando esos ingredientes aparezcan en la lista del usuario; NO los añadas si no los ha proporcionado:
  · Huevo entero (1 ud ≈ 50 g): 6 g proteína, 0 g carbo, 5 g grasa, 70 kcal.
  · Clara de huevo (1 ud ≈ 33 g): 3.6 g prot, 0 carbo, 0 grasa, 17 kcal.
  · Pechuga de pollo (100 g cruda): 23 g prot, 0 carbo, 2 g grasa, 110 kcal.
  · Pavo (100 g): 22 g prot, 0 carbo, 2 g grasa, 105 kcal.
  · Ternera magra (100 g): 21 g prot, 0 carbo, 6 g grasa, 145 kcal.
  · Atún en agua (100 g): 24 g prot, 0 carbo, 1 g grasa, 110 kcal.
  · Salmón (100 g): 20 g prot, 0 carbo, 13 g grasa, 200 kcal.
  · Verduras de hoja/no almidonadas (100 g): ~2 g prot, ~4 g carbo, 0 g grasa, ~25 kcal.
  · Tomate, pepino, calabacín, pimiento, champiñones (100 g): 1–2 g prot, 3–4 g carbo, 0 g grasa, ~20 kcal.
  · Patata cocida (100 g): 2 g prot, 17 g carbo, 0 g grasa, 80 kcal.
  · Arroz blanco cocido (100 g): 2.5 g prot, 28 g carbo, 0.3 g grasa, 130 kcal.
  · Pasta cocida (100 g): 5 g prot, 30 g carbo, 1 g grasa, 150 kcal.
  · Pan integral (100 g): 9 g prot, 43 g carbo, 3 g grasa, 240 kcal.
  · Avena (100 g cruda): 13 g prot, 60 g carbo, 7 g grasa, 370 kcal.
  · Legumbres cocidas (100 g): 8 g prot, 18 g carbo, 1 g grasa, 120 kcal.
  · Lácteos (solo si el usuario los incluyó): leche desnatada (100 ml) 3.4 g prot, 5 g carbo, 0 g grasa, 35 kcal; yogur griego natural (100 g) 9 g prot, 4 g carbo, 5 g grasa, 95 kcal; queso fresco batido 0% (100 g) 8 g prot, 4 g carbo, 0 g grasa, 50 kcal.
- COHERENCIA CALÓRICA OBLIGATORIA: calories = round(protein*4 + carbs*4 + fat*9). NO inventes calorías que no cuadren con los macros.
- Los macros del JSON son POR PORCIÓN (divide el total entre "servings").
- Etiqueta "alta proteína" SOLO si la proteína TOTAL de la receta es ≥ 25 g. Etiqueta "baja en calorías" SOLO si ≤ 450 kcal por porción. No mezcles etiquetas que no se cumplan.`;

  const jsonShape = `{"title":"","description":"","servings":2,"prep_time":20,"nutrition_status":"verified","nutrition_reference":"USDA FoodData Central — alimento genérico y FDC ID","nutrition_note":"","macros":{"protein":0,"carbs":0,"fat":0,"fiber":0,"calories":0},"total_macros":{"protein":0,"carbs":0,"fat":0,"fiber":0,"calories":0},"ingredients":[{"name":"","quantity":""}],"steps":["paso..."],"tags":["alta proteína"]}`;

  if (body.mode === "monthly") {
    return `${base}

Genera un plan mensual de 30 recetas variadas y saludables usando preferentemente estos ingredientes disponibles: ${ing || "ingredientes comunes"}.
Preferencias: ${prefs.length ? prefs.join("; ") : "alta proteína y bajas en calorías por defecto, equilibradas"}.

Responde EXCLUSIVAMENTE con un JSON válido con esta forma exacta:
{"recipes":[${jsonShape}]}
Exactamente 30 recetas variadas (desayunos, comidas, cenas, snacks). Cada receta DEBE incluir macros completos (protein, carbs, fat, calories en números), ingredientes con cantidad y pasos. Sin texto fuera del JSON.`;
  }

  if (body.mode === "ingredients") {
    if (!ing) {
      return `${base}\n\nDevuelve {"error":"missing_ingredients"} como JSON.`;
    }
    return `${base}

REGLA ESTRICTA: La receta DEBE crearse EXCLUSIVAMENTE con los siguientes ingredientes proporcionados por la usuaria: ${ing}.
- NO añadas ningún ingrediente principal adicional (proteínas, verduras, frutas, lácteos, cereales, legumbres, grasas, etc.) que no esté en la lista.
- SOLO se permite añadir como extras: agua, sal, pimienta, ajo fresco o ajo en polvo, cebolla en polvo, pimentón, curry, cúrcuma, orégano, albahaca, perejil, romero, tomillo, otras especias/hierbas aromáticas, y hasta 5 ml de aceite de oliva virgen extra.
- NO añadas claras de huevo, leche, yogur, proteína en polvo ni ningún otro alimento para aumentar artificialmente la proteína.
- Si los ingredientes son insuficientes para una receta coherente, devuelve {"error":"insufficient_ingredients"} como JSON.

Responde EXCLUSIVAMENTE con un JSON válido con esta forma exacta:
${jsonShape}

Requisitos OBLIGATORIOS del JSON:
- "ingredients": array de objetos {"name","quantity"}; SOLO los ingredientes de la lista (más condimentos básicos permitidos).
- "quantity": cantidad concreta en sistema métrico (g, ml, unidades), tomada de la lista de la persona usuaria. Si falta, devuelve "missing_quantities".
- "steps": pasos claros y numerables de preparación.
- "macros" y "total_macros": protein, carbs, fat, fiber y calories en números, con fuente declarada. Si no hay fuente verificable, usa nutrition_status="unavailable" y no inventes valores.
- "calories" debe ser coherente con la energía declarada por la fuente y con los macronutrientes.
- Sin texto fuera del JSON.`;
  }

  return `${base}

Crea UNA receta saludable usando preferentemente: ${ing || "ingredientes comunes"}.
${prefs.length ? `Preferencias: ${prefs.join("; ")}.` : ""}

Responde EXCLUSIVAMENTE con un JSON válido:
${jsonShape}
La receta DEBE incluir macros completos (protein, carbs, fat, calories en números), ingredientes con cantidad en sistema métrico y pasos. Sin texto fuera del JSON.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Falta GEMINI_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = (await req.json()) as ReqBody;
    if (!body?.mode || !Array.isArray(body.ingredients)) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompt = buildPrompt(body);

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "Devuelve únicamente JSON válido, sin markdown ni explicaciones." }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
        }),
      },
    );
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("Gemini error", aiRes.status, txt);
      return new Response(JSON.stringify({ error: `Error Gemini (${aiRes.status}): ${txt.slice(0, 200)}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiRes.json();
    const content: string = aiJson?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const enforceTwoServings = (recipe: any) => ({
      ...recipe,
      servings: 2,
      nutrition_status: "unavailable",
      nutrition_reference: "",
      nutrition_note: "No se muestran valores nutricionales hasta calcularlos contra una base de datos verificable (USDA FoodData Central o AESAN/BEDCA).",
      macros: {},
      total_macros: {},
    });
    if (Array.isArray(parsed?.recipes)) parsed.recipes = parsed.recipes.map(enforceTwoServings);
    else parsed = enforceTwoServings(parsed);

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
