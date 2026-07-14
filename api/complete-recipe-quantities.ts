import { createClient } from "@supabase/supabase-js";

const EXPECTED_SUPABASE_REF = "vuvdnmessgwhlggzcfqb";
const EXPECTED_SUPABASE_HOST = `${EXPECTED_SUPABASE_REF}.supabase.co`;

function pickSupabaseUrl(...candidates: Array<string | undefined>) {
  const valid = candidates.filter((url): url is string => /^https:\/\//.test(url ?? ""));
  return valid.find(url => url.includes(EXPECTED_SUPABASE_HOST)) ?? valid[0] ?? "";
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeName(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ingredientName(item: any) {
  if (typeof item === "string") return cleanText(item.replace(/^\s*[\d.,]+\s*(g|gr|gramos?|ml|mililitros?|unidad(?:es)?|raci[oó]n(?:es)?)\s+/i, ""));
  return cleanText(item?.name ?? item?.ingredient ?? item?.food ?? item?.label ?? item?.raw ?? item?.text ?? "");
}

function ingredientQuantity(item: any) {
  if (typeof item === "string") {
    const match = cleanText(item).match(/^\s*([\d.,]+)\s*(g|gr|gramos?|ml|mililitros?|unidad(?:es)?|raci[oó]n(?:es)?)\b/i);
    return match ? `${match[1]} ${match[2]}` : "";
  }
  return cleanText(item?.quantity ?? item?.amount ?? item?.qty ?? "");
}

function ingredientHasQuantity(item: any) {
  const quantity = ingredientQuantity(item);
  const grams = numberOrNull(item?.grams ?? item?.gramos ?? item?.ml);
  return /\d/.test(quantity) || (grams !== null && grams > 0);
}

function normalizeIngredients(raw: any) {
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => ({
        original: typeof item === "string" ? cleanText(item) : item,
        name: ingredientName(item),
        quantity: ingredientQuantity(item),
        grams: numberOrNull(item?.grams ?? item?.gramos ?? item?.ml),
        hasQuantity: ingredientHasQuantity(item),
      }))
      .filter(item => item.name);
  }
  return cleanText(raw)
    .split(/\n|,/)
    .map(line => cleanText(line))
    .filter(Boolean)
    .map(line => ({
      original: line,
      name: ingredientName(line),
      quantity: ingredientQuantity(line),
      grams: null,
      hasQuantity: ingredientHasQuantity(line),
    }))
    .filter(item => item.name);
}

function stepsToText(raw: any) {
  if (Array.isArray(raw)) {
    return raw.map((step: any) => typeof step === "string" ? step : step?.text ?? "").map(cleanText).filter(Boolean).join("\n");
  }
  return cleanText(raw);
}

async function verifyAdmin(authHeader: string | undefined) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Debes iniciar sesión como administradora" };

  const supabaseUrl = pickSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 500, error: "Supabase no está configurado" };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: "Sesión no válida" };

  const { data: isAdmin, error: roleError } = await (supabase as any).rpc("has_role", {
    _user_id: data.user.id,
    _role: "admin",
  });
  if (roleError || !isAdmin) return { ok: false, status: 403, error: "Solo la administradora puede completar cantidades" };

  return { ok: true, status: 200, error: "" };
}

function buildPrompt(body: any, ingredients: ReturnType<typeof normalizeIngredients>) {
  return JSON.stringify({
    tarea: "Completa cantidades culinarias realistas para recetas antiguas, sin cambiar la receta original.",
    reglas: [
      "Devuelve solo JSON válido.",
      "No añadas ingredientes nuevos.",
      "No elimines ingredientes.",
      "No sobrescribas cantidades que ya existan; consérvalas.",
      "Si falta cantidad o unidad, estima una cantidad normal y razonable para la receta.",
      "Usa unidades g o ml siempre que sea posible.",
      "Incluye grams como equivalencia en gramos o mililitros.",
      "Marca estimated true cuando hayas estimado la cantidad.",
      "Evita cantidades exageradas.",
      "Para comidas principales orienta la receta a una ración normal y aproximadamente 500 kcal si es posible.",
      "Para sal al gusto usa 0.5 g. Para especias al gusto usa 1 g. Para un chorrito de aceite usa 5 ml.",
    ],
    receta: {
      title: cleanText(body?.title),
      category: cleanText(body?.category),
      servings: Math.max(1, Math.round(Number(body?.servings) || 1)),
      preparation: stepsToText(body?.steps ?? body?.preparation),
      calorie_limit: body?.calorieLimit ?? null,
      ingredients: ingredients.map(item => ({
        name: item.name,
        current_quantity: item.quantity || null,
        current_grams: item.grams,
        has_quantity: item.hasQuantity,
      })),
    },
    formato_obligatorio: {
      servings: "number",
      ingredients: [
        {
          name: "string",
          quantity: "number",
          unit: "g | ml | unidad | ración",
          grams: "number",
          estimated: "boolean",
        },
      ],
    },
  });
}

async function callGemini(apiKey: string, prompt: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "Eres una nutricionista culinaria. Completa cantidades de ingredientes antiguos y responde únicamente JSON válido." }],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`Gemini ${response.status}: ${text.slice(0, 500)}`);
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

function validateResponse(raw: any, originalIngredients: ReturnType<typeof normalizeIngredients>) {
  const byName = new Map(originalIngredients.map(item => [normalizeName(item.name), item]));
  const ingredients = Array.isArray(raw?.ingredients) ? raw.ingredients : [];
  if (ingredients.length !== originalIngredients.length) {
    throw new Error("La IA no devolvió todos los ingredientes originales.");
  }

  return ingredients.map((item: any) => {
    const name = ingredientName(item);
    const original = byName.get(normalizeName(name));
    if (!name || !original) {
      throw new Error(`La IA devolvió un ingrediente no reconocido: ${name || "sin nombre"}`);
    }
    const quantityNumber = numberOrNull(item?.quantity);
    const grams = numberOrNull(item?.grams);
    const unit = cleanText(item?.unit || "g").toLowerCase();
    if (quantityNumber === null || quantityNumber <= 0 || grams === null || grams <= 0) {
      throw new Error(`Cantidad inválida para ${name}`);
    }
    return {
      name: original.name,
      quantity: `${quantityNumber} ${unit}`,
      unit,
      grams,
      estimated: original.hasQuantity ? Boolean(item?.estimated) : true,
    };
  });
}

function friendlyError(err: any) {
  const raw = String(err?.message ?? "");
  const lower = raw.toLowerCase();
  if (lower.includes("429") || lower.includes("quota") || lower.includes("resource_exhausted")) {
    return "El generador gratuito no está disponible temporalmente. Inténtalo de nuevo más tarde.";
  }
  if (err?.name === "AbortError") return "La estimación ha tardado demasiado. Inténtalo de nuevo.";
  return raw || "No se pudieron completar las cantidades.";
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin.ok) return res.status(admin.status).json({ error: admin.error });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "El generador gratuito no está disponible temporalmente. Inténtalo de nuevo más tarde." });

  const body = req.body ?? {};
  const ingredients = normalizeIngredients(body.ingredients);
  if (!ingredients.length) return res.status(400).json({ error: "La receta no tiene ingredientes para completar." });

  try {
    const raw = await callGemini(apiKey, buildPrompt(body, ingredients));
    const completed = validateResponse(raw, ingredients);
    return res.status(200).json({
      servings: Math.max(1, Math.round(Number(raw?.servings || body.servings) || 1)),
      ingredients: completed,
      notice: "Cantidades estimadas automáticamente. Revísalas antes de guardar.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: friendlyError(err) });
  }
}
