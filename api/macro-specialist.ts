import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes } from "node:crypto";

type MacroStatus = "verificado" | "estimado" | "pendiente de revisión";

type IngredientInput = {
  name?: string;
  grams?: number | string;
  raw?: string;
};

type FoodMacro = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  aliases?: string[];
};

type MacroValues = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

type FatSecretToken = {
  accessToken: string;
  expiresAt: number;
};

const BASIC_FOODS: Record<string, FoodMacro> = {
  pollo: { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, aliases: ["pechuga de pollo", "pollo cocido"] },
  "pechuga de pavo": { kcal: 105, protein: 22.5, carbs: 1, fat: 1.5, fiber: 0, aliases: ["pavo", "fiambre de pavo", "pavo cocido", "turkey breast", "sliced turkey breast"] },
  huevo: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0, aliases: ["huevos"] },
  "clara de huevo": { kcal: 52, protein: 10.9, carbs: 0.7, fat: 0.2, fiber: 0, aliases: ["claras"] },
  atun: { kcal: 116, protein: 25.5, carbs: 0, fat: 0.8, fiber: 0, aliases: ["atún", "atun natural", "atún natural"] },
  salmon: { kcal: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, aliases: ["salmón"] },
  merluza: { kcal: 89, protein: 17, carbs: 0, fat: 1.9, fiber: 0 },
  arroz: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, aliases: ["arroz cocido"] },
  "arroz integral": { kcal: 123, protein: 2.7, carbs: 25.6, fat: 1, fiber: 1.8 },
  "tortitas de arroz": { kcal: 384, protein: 7.3, carbs: 80, fat: 2.8, fiber: 3.4, aliases: ["tortita de arroz", "tortitas arroz", "rice cakes", "rice cake"] },
  pasta: { kcal: 157, protein: 5.8, carbs: 30.9, fat: 0.9, fiber: 1.8, aliases: ["pasta cocida"] },
  patata: { kcal: 87, protein: 1.9, carbs: 20.1, fat: 0.1, fiber: 1.8, aliases: ["papa"] },
  boniato: { kcal: 86, protein: 1.6, carbs: 20.1, fat: 0.1, fiber: 3, aliases: ["batata"] },
  avena: { kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6 },
  quinoa: { kcal: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fiber: 2.8 },
  garbanzos: { kcal: 164, protein: 8.9, carbs: 27.4, fat: 2.6, fiber: 7.6 },
  lentejas: { kcal: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9 },
  "leche desnatada": { kcal: 34, protein: 3.4, carbs: 5, fat: 0.1, fiber: 0, aliases: ["leche desnatada con cafe", "leche desnatada con café", "leche descremada", "leche sin grasa", "skim milk", "nonfat milk"] },
  "queso fresco": { kcal: 98, protein: 12, carbs: 3, fat: 4, fiber: 0 },
  "yogur natural": { kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0 },
  "yogur griego": { kcal: 97, protein: 9, carbs: 3.6, fat: 5, fiber: 0 },
  "proteina en polvo": { kcal: 390, protein: 78, carbs: 8, fat: 6, fiber: 0, aliases: ["proteína", "proteina", "whey"] },
  tomate: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2 },
  calabacin: { kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1, aliases: ["calabacín"] },
  brocoli: { kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, aliases: ["brócoli"] },
  espinacas: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2 },
  zanahoria: { kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8 },
  cebolla: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7 },
  lechuga: { kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3 },
  fresas: { kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2 },
  platano: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, aliases: ["plátano", "banana"] },
  manzana: { kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4 },
  aguacate: { kcal: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7 },
  "aceite de oliva": { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, aliases: ["aove", "aceite"] },
  almendras: { kcal: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5 },
};

let fatSecretToken: FatSecretToken | null = null;

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(g|gr|gramos|kg|ml|mililitros|unidad|unidades|cocido|cocida|crudo|cruda)\b/g, " ")
    .replace(/\bcon cafe\b/g, " ")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSearchName(value: string) {
  return normalizeName(value)
    .replace(/\bde\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FOOD_INDEX = new Map<string, { key: string; food: FoodMacro }>();
for (const [key, food] of Object.entries(BASIC_FOODS)) {
  FOOD_INDEX.set(normalizeName(key), { key, food });
  for (const alias of food.aliases ?? []) FOOD_INDEX.set(normalizeName(alias), { key, food });
}

function parseRawIngredient(raw: string): IngredientInput {
  const qtyMatch = raw.match(/(\d+(?:[,.]\d+)?)\s*(g|gr|gramos|ml|mililitros)\b/i);
  const grams = qtyMatch ? Number(qtyMatch[1].replace(",", ".")) : undefined;
  const name = raw.replace(/(\d+(?:[,.]\d+)?)\s*(g|gr|gramos|ml|mililitros)\b/i, "").trim();
  return { raw, name, grams };
}

function findFood(name: string) {
  const normalized = normalizeName(name);
  if (FOOD_INDEX.has(normalized)) return FOOD_INDEX.get(normalized)!;
  for (const [candidate, value] of FOOD_INDEX.entries()) {
    if (normalized.includes(candidate) || candidate.includes(normalized)) return value;
  }
  return null;
}

function scale(food: FoodMacro, grams: number): MacroValues {
  const factor = grams / 100;
  return {
    kcal: food.kcal * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
    fiber: food.fiber * factor,
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function zeroMacros(): MacroValues {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}

function addMacros(target: MacroValues, value: MacroValues) {
  target.kcal += value.kcal;
  target.protein += value.protein;
  target.carbs += value.carbs;
  target.fat += value.fat;
  target.fiber += value.fiber;
}

function getFatSecretCredentials() {
  const key = String(process.env.FATSECRET_CONSUMER_KEY || process.env.FATSECRET_CLIENT_ID || "").trim();
  const secret = String(process.env.FATSECRET_CONSUMER_SECRET || process.env.FATSECRET_CLIENT_SECRET || "").trim();
  return key && secret ? { key, secret } : null;
}

async function getFatSecretToken() {
  const credentials = getFatSecretCredentials();
  if (!credentials) return null;
  if (fatSecretToken && fatSecretToken.expiresAt > Date.now() + 60_000) return fatSecretToken.accessToken;

  const basic = Buffer.from(`${credentials.key}:${credentials.secret}`).toString("base64");
  const response = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "basic",
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(`FatSecret auth ${response.status}`);
  }

  fatSecretToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in) || 3600) * 1000,
  };
  return fatSecretToken.accessToken;
}

function numberValue(value: any) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function servingToMacros(serving: any, amount: number): MacroValues | null {
  const metricAmount = numberValue(serving?.metric_serving_amount);
  const metricUnit = String(serving?.metric_serving_unit || "").toLowerCase();
  if (!metricAmount || !["g", "ml"].includes(metricUnit)) return null;

  const factor = amount / metricAmount;
  return {
    kcal: numberValue(serving?.calories) * factor,
    protein: numberValue(serving?.protein) * factor,
    carbs: numberValue(serving?.carbohydrate) * factor,
    fat: numberValue(serving?.fat) * factor,
    fiber: numberValue(serving?.fiber) * factor,
  };
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function scoreFood(food: any, query: string) {
  const normalizedFood = normalizeName(food?.food_name ?? "");
  const normalizedQuery = normalizeName(query);
  if (!normalizedFood || !normalizedQuery) return 0;
  if (normalizedFood === normalizedQuery) return 100;
  const foodTokens = new Set(normalizedFood.split(" "));
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const overlap = queryTokens.filter(token => foodTokens.has(token)).length;
  return overlap * 12 + (normalizedFood.includes(normalizedQuery) ? 25 : 0) + (normalizedQuery.includes(normalizedFood) ? 15 : 0);
}

function pickBestFood(foods: any[], query: string) {
  return foods
    .map(food => ({ food, score: scoreFood(food, query) }))
    .sort((a, b) => b.score - a.score)[0]?.food ?? foods[0];
}

function pickBestServing(servings: any[], amount: number) {
  const metricServings = servings.filter(serving => {
    const unit = String(serving?.metric_serving_unit || "").toLowerCase();
    return numberValue(serving?.metric_serving_amount) > 0 && ["g", "ml"].includes(unit);
  });
  if (!metricServings.length) return null;

  return metricServings
    .map(serving => ({
      serving,
      score: Math.abs(numberValue(serving.metric_serving_amount) - Math.min(100, amount)),
    }))
    .sort((a, b) => a.score - b.score)[0].serving;
}

async function fatSecretRequest(path: string, params: Record<string, string>) {
  const token = await getFatSecretToken();
  if (!token) return null;

  const url = new URL(`https://platform.fatsecret.com/rest/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`FatSecret ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function searchFatSecretV3(name: string, amount: number) {
  const query = cleanSearchName(name);
  if (!query) return null;

  const searchPayload = await fatSecretRequest("foods/search/v3", {
    search_expression: query,
    format: "json",
    max_results: "8",
    region: "ES",
    language: "es",
  });
  const foods = asArray(searchPayload?.foods_search?.results?.food);
  if (!foods.length) return null;

  const bestFood = pickBestFood(foods, query);
  const servings = asArray(bestFood?.servings?.serving);
  const serving = pickBestServing(servings, amount);
  const macros = serving ? servingToMacros(serving, amount) : null;
  if (!macros) return null;

  return {
    matchedAs: bestFood.food_name ?? query,
    foodId: bestFood.food_id,
    serving,
    macros,
  };
}

async function searchFatSecretLegacy(name: string, amount: number) {
  const query = cleanSearchName(name);
  if (!query) return null;

  const searchPayload = await fatSecretRequest("server.api", {
    method: "foods.search",
    search_expression: query,
    format: "json",
    max_results: "8",
  });
  const foods = asArray(searchPayload?.foods?.food);
  if (!foods.length) return null;
  const bestFood = pickBestFood(foods, query);

  const foodPayload = await fatSecretRequest("server.api", {
    method: "food.get",
    food_id: String(bestFood.food_id),
    format: "json",
  });
  const servings = asArray(foodPayload?.food?.servings?.serving);
  const serving = pickBestServing(servings, amount);
  const macros = serving ? servingToMacros(serving, amount) : null;
  if (!macros) return null;

  return {
    matchedAs: foodPayload?.food?.food_name ?? bestFood.food_name ?? query,
    foodId: bestFood.food_id,
    serving,
    macros,
  };
}

function oauthEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildOAuth1Url(params: Record<string, string>) {
  const credentials = getFatSecretCredentials();
  if (!credentials) return null;

  const baseUrl = "https://platform.fatsecret.com/rest/server.api";
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.key,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };

  const signatureParams = { ...params, ...oauthParams };
  const normalized = Object.entries(signatureParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${oauthEncode(key)}=${oauthEncode(value)}`)
    .join("&");
  const signatureBase = ["GET", oauthEncode(baseUrl), oauthEncode(normalized)].join("&");
  const signingKey = `${oauthEncode(credentials.secret)}&`;
  const signature = createHmac("sha1", signingKey).update(signatureBase).digest("base64");

  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries({ ...params, ...oauthParams, oauth_signature: signature })) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function fatSecretOAuth1Request(params: Record<string, string>) {
  const url = buildOAuth1Url(params);
  if (!url) return null;

  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`FatSecret OAuth1 ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function searchFatSecretOAuth1(name: string, amount: number) {
  const query = cleanSearchName(name);
  if (!query) return null;

  const searchPayload = await fatSecretOAuth1Request({
    method: "foods.search",
    search_expression: query,
    format: "json",
    max_results: "8",
  });
  const foods = asArray(searchPayload?.foods?.food);
  if (!foods.length) return null;
  const bestFood = pickBestFood(foods, query);

  const foodPayload = await fatSecretOAuth1Request({
    method: "food.get",
    food_id: String(bestFood.food_id),
    format: "json",
  });
  const servings = asArray(foodPayload?.food?.servings?.serving);
  const serving = pickBestServing(servings, amount);
  const macros = serving ? servingToMacros(serving, amount) : null;
  if (!macros) return null;

  return {
    matchedAs: foodPayload?.food?.food_name ?? bestFood.food_name ?? query,
    foodId: bestFood.food_id,
    serving,
    macros,
  };
}

async function calculateWithFatSecret(name: string, grams: number) {
  if (!getFatSecretCredentials()) return null;
  const internalMatch = findFood(name);
  const candidates = Array.from(new Set([
    name,
    internalMatch?.key,
    ...(internalMatch?.food.aliases ?? []),
  ].filter(Boolean).map(String)));

  for (const candidate of candidates) {
    try {
      const result = await searchFatSecretOAuth1(candidate, grams);
      if (result) return result;
    } catch {
      // Si las credenciales son OAuth 2.0 en lugar de Consumer Key/Secret, probamos el flujo Bearer.
      break;
    }
  }

  try {
    return await searchFatSecretV3(candidates[0] ?? name, grams);
  } catch {
    try {
      return await searchFatSecretLegacy(candidates[0] ?? name, grams);
    } catch {
      return null;
    }
  }
}

async function verifySession(authHeader: string | undefined) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Debes iniciar sesión" };

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return { ok: false, status: 500, error: "Supabase no está configurado" };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: "Sesión no válida" };

  return { ok: true, status: 200, error: "" };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const session = await verifySession(req.headers.authorization);
  if (!session.ok) return res.status(session.status).json({ error: session.error });

  const body = req.body ?? {};
  const servings = Math.max(1, Math.round(Number(body.servings) || 1));
  const inputIngredients: IngredientInput[] = Array.isArray(body.ingredients)
    ? body.ingredients
    : String(body.ingredientsText || "")
      .split("\n")
      .map((line: string) => line.trim())
      .filter(Boolean)
      .map(parseRawIngredient);

  const externalApisConfigured = {
    fatSecret: Boolean(getFatSecretCredentials()),
    usda: Boolean(process.env.USDA_API_KEY),
  };

  const totals = zeroMacros();
  const found: any[] = [];
  const notFound: any[] = [];
  const missingGrams: any[] = [];
  const fallbackUsed: any[] = [];
  const fatSecretErrors: any[] = [];

  for (const ingredient of inputIngredients) {
    const name = String(ingredient.name || ingredient.raw || "").trim();
    const grams = Number(ingredient.grams);
    if (!name) continue;
    if (!Number.isFinite(grams) || grams <= 0) {
      missingGrams.push({ name, raw: ingredient.raw ?? name });
      continue;
    }

    const fatSecretMatch = await calculateWithFatSecret(name, grams);
    if (fatSecretMatch?.macros) {
      addMacros(totals, fatSecretMatch.macros);
      found.push({
        name,
        matchedAs: fatSecretMatch.matchedAs,
        grams,
        source: "fatsecret",
        foodId: fatSecretMatch.foodId,
        macros: Object.fromEntries(Object.entries(fatSecretMatch.macros).map(([k, v]) => [k, round(v)])),
      });
      continue;
    }

    const match = findFood(name);
    if (!match) {
      notFound.push({ name, grams, raw: ingredient.raw ?? name });
      if (externalApisConfigured.fatSecret) fatSecretErrors.push(name);
      continue;
    }

    const itemMacros = scale(match.food, grams);
    addMacros(totals, itemMacros);
    fallbackUsed.push({ name, matchedAs: match.key });
    found.push({
      name,
      matchedAs: match.key,
      grams,
      source: "tabla_interna",
      macros: Object.fromEntries(Object.entries(itemMacros).map(([k, v]) => [k, round(v)])),
    });
  }

  const status: MacroStatus =
    notFound.length || missingGrams.length
      ? "pendiente de revisión"
      : fallbackUsed.length || !externalApisConfigured.fatSecret
        ? "estimado"
        : "verificado";

  const totalRounded = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round(v)]));
  const perServing = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round(v / servings)]));

  return res.status(200).json({
    status,
    category: body.category ?? "",
    containsHerbalife: Boolean(body.containsHerbalife),
    preferences: body.preferences ?? "",
    restrictions: body.restrictions ?? "",
    servings,
    perServing,
    totals: totalRounded,
    found,
    notFound,
    missingGrams,
    warnings: {
      notFound: notFound.map(i => i.name),
      missingGrams: missingGrams.map(i => i.name),
      fallbackUsed,
      fatSecretUnavailableFor: fatSecretErrors,
      externalApisConfigured,
      dataSource: externalApisConfigured.fatSecret
        ? fallbackUsed.length || notFound.length || missingGrams.length
          ? "fatsecret_con_respaldo_tabla_interna"
          : "fatsecret"
        : "tabla_interna_basica_por_100g",
    },
    envPrepared: ["FATSECRET_CONSUMER_KEY", "FATSECRET_CONSUMER_SECRET", "USDA_API_KEY"],
  });
}
