import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes } from "node:crypto";
import { INITIAL_INTERNAL_FOODS } from "./internal-foods-data.js";

type MacroStatus = "verificado" | "estimado" | "pendiente de revisión";

type IngredientInput = {
  name?: string;
  grams?: number | string;
  unit?: string;
  quantity?: number;
  raw?: string;
};

type FoodMacro = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  micronutrients?: Record<string, number>;
  aliases?: string[];
};

type InternalFoodRow = {
  id: string;
  name: string;
  synonyms: string[] | null;
  base_quantity: number | string;
  base_unit: "g" | "ml" | "serving";
  calories: number | string;
  protein: number | string;
  carbs: number | string;
  fat: number | string;
  fiber: number | string;
  hidratos?: number | string | null;
  hidratos_g?: number | string | null;
  hidratos_de_carbono?: number | string | null;
  carbohidratos?: number | string | null;
  fibra?: number | string | null;
  fibra_g?: number | string | null;
  calorias?: number | string | null;
  kcal?: number | string | null;
  proteinas?: number | string | null;
  proteinas_g?: number | string | null;
  grasas?: number | string | null;
  grasas_g?: number | string | null;
  salt?: number | string | null;
  azucares_g?: number | string | null;
  grasas_saturadas_g?: number | string | null;
  category: string | null;
  source: string | null;
  is_active: boolean;
};

type UnifiedFoodRow = {
  id: string;
  source_type?: "bedca" | "usda" | "open_food_facts" | "manual";
  source_id?: string | null;
  nombre: string;
  nombre_normalizado: string;
  aliases: string[] | null;
  categoria: string | null;
  estado: "crudo" | "cocido" | "natural" | "procesado";
  kcal_100g: number | string | null;
  proteina_100g: number | string | null;
  hidratos_100g: number | string | null;
  grasa_100g: number | string | null;
  fibra_100g: number | string | null;
  azucares_100g?: number | string | null;
  sal_100g?: number | string | null;
  fuente: string | null;
  verificado: boolean;
  is_active: boolean;
  raw_data?: Record<string, any> | null;
};

type ProductMeasureRow = {
  id: string;
  name: string;
  grams: number | string;
  calories: number | string;
  protein: number | string;
  carbs: number | string;
  fat: number | string;
  fiber: number | string;
  source?: string | null;
  verification_status?: string | null;
  is_default: boolean;
  sort_order: number | string;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string | null;
  aliases?: string[] | null;
  source?: string | null;
  verification_status?: string | null;
  calories: number | string;
  protein: number | string;
  carbs: number | string;
  fat: number | string;
  fiber: number | string;
  is_active: boolean;
  available_for_recipes: boolean;
  informative_only: boolean;
  product_measures?: ProductMeasureRow[];
};

type MacroValues = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  micronutrients: Record<string, number>;
};

type IngredientDebugEntry = {
  raw: string;
  parsedName: string;
  quantity?: number | null;
  unit?: string;
  grams: number | null;
  status: string;
  source?: string;
  sourceLabel?: string;
  matchedAs?: string;
  providerMatchedAs?: string;
  foodId?: string;
  macros?: Record<string, any>;
  rawNutrition?: Record<string, any>;
  calorieCheck?: { formulaKcal: number; displayedKcal: number; difference: number };
  attempts?: any[];
};

type FatSecretToken = {
  accessToken: string;
  expiresAt: number;
};

type ProviderMacroMatch = {
  matchedAs: string;
  displayName: string;
  providerMatchedAs: string;
  foodId?: string;
  macros: MacroValues;
  provider: "usda" | "fatsecret";
};

type MatchMode = "exact" | "partial";

const BASIC_FOODS: Record<string, FoodMacro> = {
  pollo: { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, aliases: ["pechuga de pollo", "pollo cocido"] },
  "pechuga de pavo": { kcal: 105, protein: 22.5, carbs: 1, fat: 1.5, fiber: 0, aliases: ["pavo", "fiambre de pavo", "pavo cocido", "turkey breast", "sliced turkey breast"] },
  huevo: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0, aliases: ["huevos"] },
  "clara de huevo": { kcal: 52, protein: 10.9, carbs: 0.7, fat: 0.2, fiber: 0, aliases: ["claras"] },
  atun: { kcal: 116, protein: 25.5, carbs: 0, fat: 0.8, fiber: 0, aliases: ["atún", "atun natural", "atún natural"] },
  salmon: { kcal: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, aliases: ["salmón"] },
  lubina: { kcal: 97, protein: 18.4, carbs: 0, fat: 2, fiber: 0, aliases: ["robalo", "sea bass", "european sea bass"] },
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

function setCorsHeaders(req: any, res: any) {
  const origin = String(req.headers?.origin || "*");
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function safeLowerCase(value: unknown, functionName: string) {
  console.info("[macro-specialist] toLowerCase guard", {
    file: "api/macro-specialist.ts",
    functionName,
    value,
    valueType: typeof value,
    wasNullish: value === null || value === undefined,
  });
  return String(value ?? "").toLowerCase();
}

function normalizeName(value: unknown) {
  return safeLowerCase(value, "normalizeName")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[•·●▪▫◦*]/g, " ")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(g|gr|gramos|kg|ml|mililitros|unidad|unidades|cocido|cocida|crudo|cruda)\b/g, " ")
    .replace(/\bcon cafe\b/g, " ")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFoodRankingText(value: unknown) {
  return safeLowerCase(value, "normalizeFoodRankingText")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[•·●▪▫◦*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSearchName(value: unknown) {
  return normalizeName(value)
    .replace(/\b(de|del|la|el|los|las|virgen|extra)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MATCH_STOP_WORDS = new Set([
  "de", "del", "la", "el", "los", "las", "the", "of", "a", "al",
  "verde", "verdes", "rojo", "roja", "rojos", "rojas", "blanco", "blanca", "blancos", "blancas",
  "negro", "negra", "negros", "negras", "fresco", "fresca", "frescos", "frescas",
  "natural", "naturales", "laminado", "laminada", "laminados", "laminadas",
  "troceado", "troceada", "troceados", "troceadas", "picado", "picada", "picados", "picadas",
  "molido", "molida", "molidos", "molidas", "rallado", "rallada", "rallados", "ralladas",
  "escurrido", "escurrida", "escurridos", "escurridas",
  "entero", "entera", "enteros", "enteras", "cocido", "cocida", "cocidos", "cocidas",
  "crudo", "cruda", "crudos", "crudas", "sin", "con",
]);
const BASIC_INGREDIENT_PRODUCT_BLOCKLIST = new Set([
  "aceite",
  "agua",
  "ajo",
  "arroz",
  "avena",
  "calabacin",
  "calabacín",
  "caldo",
  "carne",
  "cebolla",
  "champiñon",
  "champiñones",
  "champinon",
  "champinones",
  "maicena",
  "manzana",
  "patata",
  "platano",
  "plátano",
  "pollo",
  "ternera",
  "tomate",
  "vinagre",
  "vino",
  "zanahoria",
]);

function significantFoodTokens(value: unknown) {
  return normalizeFoodRankingText(value)
    .split(" ")
    .map(token => token.trim())
    .filter(token => token.length > 1 && !MATCH_STOP_WORDS.has(token));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsWholeNormalizedPhrase(container: string, phrase: string) {
  if (!container || !phrase) return false;
  const phrasePattern = escapeRegExp(phrase).replace(/\s+/g, "\\s+");
  return new RegExp(`(^|\\s)${phrasePattern}($|\\s)`).test(container);
}

function isBasicIngredientOnlyQuery(value: unknown) {
  const normalized = normalizeName(value);
  if (!normalized) return false;
  if (asksForPreparedFood(normalized) || asksForDerivedFood(normalized)) return false;
  const tokens = significantFoodTokens(normalized);
  return tokens.some(token => BASIC_INGREDIENT_PRODUCT_BLOCKLIST.has(token));
}

function tokenSimilarity(candidate: unknown, query: unknown) {
  const candidateTokens = significantFoodTokens(candidate);
  const queryTokens = significantFoodTokens(query);
  if (!candidateTokens.length || !queryTokens.length) return 0;
  const candidateSet = new Set(candidateTokens);
  const overlap = queryTokens.filter(token => candidateSet.has(token)).length;
  return overlap / Math.max(candidateTokens.length, queryTokens.length);
}

function hasSameSignificantFoodTokens(candidate: unknown, query: unknown) {
  const candidateTokens = Array.from(new Set(significantFoodTokens(candidate)));
  const queryTokens = Array.from(new Set(significantFoodTokens(query)));
  if (!candidateTokens.length || !queryTokens.length) return false;
  if (candidateTokens.length !== queryTokens.length) return false;
  const querySet = new Set(queryTokens);
  return candidateTokens.every(token => querySet.has(token));
}

function foodCategoryGroup(value: unknown, category?: unknown) {
  const text = normalizeName(`${String(value ?? "")} ${String(category ?? "")}`);
  if (!text) return null;
  if (/\b(caldo|broth|stock)\b/.test(text)) return "broth";
  if (/\b(ternera|vacuno|res|beef|pollo|chicken|pavo|turkey|carne|meat|cerdo|pork)\b/.test(text)) return "meat";
  if (/\b(queso|cheese|yogur|yogurt|leche|milk|lacteo|dairy)\b/.test(text)) return "dairy";
  if (/\b(cebolla|onion|tomate|tomato|zanahoria|carrot|calabacin|zucchini|verdura|vegetable)\b/.test(text)) return "vegetable";
  if (/\b(ajo|garlic|pimienta|pepper|sal|salt|especia|spice)\b/.test(text)) return "seasoning";
  if (/\b(champinon|champinones|seta|setas|hongo|hongos|mushroom|mushrooms)\b/.test(text)) return "mushroom";
  if (/\b(arroz|rice|avena|oat|oats|maicena|cornstarch|almidon|starch|fecula|patata|potato)\b/.test(text)) return "starch";
  if (/\b(aceite|oil|oliva|olive)\b/.test(text)) return "oil";
  if (/\b(manzana|apple|platano|banana|fruta|fruit)\b/.test(text)) return "fruit";
  return null;
}

function hasFoodCategoryConflict(candidate: unknown, query: unknown, candidateCategory?: unknown) {
  const candidateGroup = foodCategoryGroup(candidate, candidateCategory);
  const queryGroup = foodCategoryGroup(query);
  return Boolean(candidateGroup && queryGroup && candidateGroup !== queryGroup);
}

function isReliableFoodNameMatch(candidate: unknown, query: unknown) {
  const candidateName = normalizeName(candidate);
  const queryName = normalizeName(query);
  if (!candidateName || !queryName) return false;
  if (candidateName === queryName) return true;
  if (hasFoodCategoryConflict(candidate, query)) return false;
  if (isDisallowedDefaultProcessedMatch(String(candidate ?? ""), String(query ?? ""))) return false;

  const candidateTokens = significantFoodTokens(candidate);
  const queryTokens = significantFoodTokens(query);
  if (!candidateTokens.length || !queryTokens.length) return false;

  const candidateSet = new Set(candidateTokens);
  const querySet = new Set(queryTokens);
  const queryCovered = queryTokens.every(token => candidateSet.has(token));
  const candidateCovered = candidateTokens.every(token => querySet.has(token));
  const similarity = tokenSimilarity(candidate, query);

  if (isGenericSimpleFoodQuery(String(query ?? ""))) {
    return queryCovered && candidateTokens.length <= queryTokens.length + 1 && similarity >= 0.5;
  }

  return (queryCovered || candidateCovered) && similarity >= 0.6;
}

const FOOD_INDEX = new Map<string, { key: string; food: FoodMacro }>();
for (const [key, food] of Object.entries(BASIC_FOODS)) {
  FOOD_INDEX.set(normalizeName(key), { key, food });
  for (const alias of food.aliases ?? []) FOOD_INDEX.set(normalizeName(alias), { key, food });
}

function parseRawIngredient(raw: unknown): IngredientInput {
  const rawText = String(raw ?? "").trim();
  const qtyPattern = /(\d+(?:[,.]\d+)?)\s*(medio\s+cacito|medios\s+cacitos|huevo\s+mediano|huevos\s+medianos|cacito|cacitos|scoop|scoops|sobre|sobres|stick|sticks|barrita|barritas|diente|dientes|clara|claras|huevo|huevos|g|gr|gramos|ml|mililitros|pieza|piezas|unidad|unidades|cucharada|cucharadas|cda|cdas|cucharadita|cucharaditas|cdta|cdtas)\b/i;
  const qtyMatch = rawText.match(qtyPattern);
  const quantity = qtyMatch ? Number(qtyMatch[1].replace(",", ".")) : undefined;
  const unit = qtyMatch?.[2] ? safeLowerCase(qtyMatch[2], "parseRawIngredient.unit") : undefined;
  const rawName = rawText
    .replace(qtyPattern, " ")
    .replace(/^\s*(de|del|la|el)\s+/i, "")
    .replace(/\s+(de|del|la|el)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const name = simplifyFoodName(rawName || unit || rawText);
  const grams = quantity && unit ? quantityToGrams(quantity, unit, name) : undefined;
  return { raw: rawText, name, grams, quantity, unit };
}

function roundMacros(value: MacroValues) {
  const strict = enforceMacroCalories(value);
  return {
    kcal: round(strict.kcal),
    protein: round(strict.protein),
    carbs: round(strict.carbs),
    fat: round(strict.fat),
    fiber: round(strict.fiber),
    micronutrients: Object.fromEntries(
      Object.entries(strict.micronutrients ?? {}).map(([key, micronutrientValue]) => [key, round(micronutrientValue)]),
    ),
  };
}

function formulaCalories(value: Pick<MacroValues, "protein" | "carbs" | "fat">) {
  return value.protein * 4 + value.carbs * 4 + value.fat * 9;
}

function enforceMacroCalories(value: MacroValues): MacroValues {
  const storedKcal = Number(value.kcal);
  return {
    ...value,
    kcal: Number.isFinite(storedKcal) && storedKcal > 0 ? storedKcal : formulaCalories(value),
    micronutrients: value.micronutrients ?? {},
  };
}

function calorieCheck(value: MacroValues) {
  const strict = enforceMacroCalories(value);
  return {
    formulaKcal: round(strict.kcal),
    displayedKcal: round(strict.kcal),
    difference: 0,
  };
}

function simplifyFoodName(value: unknown) {
  const cleaned = cleanSearchName(value);
  const simplifications: Array<[RegExp, string]> = [
    [/\baceite\s+oliva\b.*/, "aceite de oliva"],
    [/\bcaldo\s+carne\b.*\bbajo\s+en?\s+sal\b.*/, "caldo de carne bajo en sal"],
    [/\bcaldo\s+pollo\b.*\bbajo\s+en?\s+sal\b.*/, "caldo de pollo bajo en sal"],
    [/\bcaldo\s+verduras\b.*\bbajo\s+en?\s+sal\b.*/, "caldo de verduras bajo en sal"],
    [/\bcaldo\s+ternera\b.*\bbajo\s+en?\s+sal\b.*/, "caldo de ternera bajo en sal"],
    [/\bcaldo\s+carne\b.*/, "caldo de carne"],
    [/\bcaldo\s+pollo\b.*/, "caldo de pollo"],
    [/\bcaldo\s+verduras\b.*/, "caldo de verduras"],
    [/\bcaldo\s+ternera\b.*/, "caldo de ternera"],
    [/\bfilete\s+ternera\b.*/, "ternera"],
    [/\bternera\b.*/, "ternera"],
    [/\bchampiñones?\b.*/, "champiñones"],
    [/\bchampinones?\b.*/, "champiñones"],
    [/\bmaicena\b.*/, "maicena"],
    [/\bajo\b.*/, "ajo"],
    [/\bcarne\s+pavo\b.*/, "carne de pavo"],
    [/\bpechuga\s+pavo\b.*/, "pechuga de pavo"],
    [/\bpechuga\s+pollo\b.*/, "pechuga de pollo"],
    [/\bqueso\s+fresco\s+batido\b.*/, "queso fresco batido"],
    [/\bqueso\s+fresco\b.*/, "queso fresco"],
    [/\byogur\s+griego\s+0\b.*/, "yogur griego 0"],
    [/\byogur\s+griego\b.*/, "yogur griego"],
    [/\byogur\s+natural\b.*/, "yogur natural"],
  ];
  for (const [pattern, replacement] of simplifications) {
    if (pattern.test(cleaned)) return replacement;
  }
  return cleaned;
}

function densityForLiquid(foodName: unknown) {
  const normalizedFood = normalizeName(foodName);
  if (/\b(aceite|oliva|oil)\b/.test(normalizedFood)) return 0.9;
  if (/\b(miel|honey)\b/.test(normalizedFood)) return 1.4;
  if (/\b(jarabe|sirope|syrup)\b/.test(normalizedFood)) return 1.33;
  return 1;
}

function quantityToGrams(quantity: number, unit: unknown, foodName: unknown) {
  const normalizedUnit = safeLowerCase(unit, "quantityToGrams.unit");
  if (["g", "gr", "gramos"].includes(normalizedUnit)) return quantity;
  if (["ml", "mililitros"].includes(normalizedUnit)) return quantity * densityForLiquid(foodName);
  if (["cucharada", "cucharadas", "cda", "cdas"].includes(normalizedUnit)) {
    if (normalizeName(foodName).includes("aceite")) return quantity * 13.5;
    return quantity * 10;
  }
  if (["cucharadita", "cucharaditas", "cdta", "cdtas"].includes(normalizedUnit)) {
    if (normalizeName(foodName).includes("aceite")) return quantity * 4.5;
    return quantity * 5;
  }
  if (["diente", "dientes"].includes(normalizedUnit)) return quantity * 4;
  if (["clara", "claras"].includes(normalizedUnit)) return quantity * 33;
  if (["huevo mediano", "huevos medianos", "huevo", "huevos"].includes(normalizedUnit)) return quantity * 60;
  if (["pieza", "piezas", "unidad", "unidades"].includes(normalizedUnit)) {
    const normalizedFood = normalizeName(foodName);
    if (normalizedFood.includes("huevo")) return quantity * 60;
    if (normalizedFood.includes("clara")) return quantity * 33;
    if (normalizedFood.includes("manzana")) return quantity * 180;
    if (normalizedFood.includes("platano") || normalizedFood.includes("banana")) return quantity * 120;
  }
  return undefined;
}

function findFood(name: string) {
  const normalized = normalizeName(name);
  if (FOOD_INDEX.has(normalized)) return FOOD_INDEX.get(normalized)!;
  for (const [candidate, value] of FOOD_INDEX.entries()) {
    if (isReliableFoodNameMatch(candidate, name)) return value;
  }
  return null;
}

function foodFromInternalRow(row: InternalFoodRow): FoodMacro {
  const nutrition = internalFoodNutrition(row);
  return {
    kcal: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    fiber: nutrition.fiber,
    micronutrients: {
      ...(numericValueIsPresent(nutrition.azucares) ? { azucares: nutrition.azucares } : {}),
      ...(numericValueIsPresent(nutrition.grasas_saturadas) ? { grasas_saturadas: nutrition.grasas_saturadas } : {}),
      ...(numericValueIsPresent(nutrition.sal) ? { sal: nutrition.sal } : {}),
    },
    aliases: row.synonyms ?? [],
  };
}

function findInternalFood(name: string, foods: InternalFoodRow[]) {
  return findInternalFoodByMode(name, foods, "partial");
}

function findInternalFoodByMode(name: string, foods: InternalFoodRow[], mode: MatchMode) {
  const normalized = normalizeName(name);
  const isDisallowedInternalCandidate = (food: InternalFoodRow) =>
    normalizeName(food.name) !== normalized &&
    !hasSameSignificantFoodTokens(food.name, name) &&
    (isDisallowedDefaultProcessedMatch(food.name, name) || hasFoodCategoryConflict(food.name, name, food.category));
  const candidates = foods
    .filter(food => food.is_active)
    .flatMap(food => [
      { key: food.name, food, normalized: normalizeName(food.name), exact: normalizeName(food.name) === normalized },
      ...((food.synonyms ?? []).map(alias => ({ key: alias, food, normalized: normalizeName(alias), exact: normalizeName(alias) === normalized }))),
    ]);

  const exact = candidates.find(candidate => candidate.exact && !isDisallowedInternalCandidate(candidate.food));
  if (exact) return { key: exact.key, row: exact.food, food: foodFromInternalRow(exact.food) };
  if (mode === "exact") return null;

  const partial = candidates
    .filter(candidate => candidate.normalized && !isDisallowedInternalCandidate(candidate.food) && isReliableFoodNameMatch(candidate.key, name))
    .sort((a, b) => tokenSimilarity(b.key, name) - tokenSimilarity(a.key, name) || a.normalized.length - b.normalized.length)[0];
  return partial ? { key: partial.key, row: partial.food, food: foodFromInternalRow(partial.food) } : null;
}

function foodFromUnifiedRow(row: UnifiedFoodRow): FoodMacro {
  return {
    kcal: numberValue(row.kcal_100g),
    protein: numberValue(row.proteina_100g),
    carbs: numberValue(row.hidratos_100g),
    fat: numberValue(row.grasa_100g),
    fiber: numberValue(row.fibra_100g),
    aliases: row.aliases ?? [],
  };
}

function scaleUnifiedFood(row: UnifiedFoodRow, grams: number): MacroValues {
  const factor = grams / 100;
  return enforceMacroCalories({
    kcal: numberValue(row.kcal_100g) * factor,
    protein: numberValue(row.proteina_100g) * factor,
    carbs: numberValue(row.hidratos_100g) * factor,
    fat: numberValue(row.grasa_100g) * factor,
    fiber: numberValue(row.fibra_100g) * factor,
    micronutrients: {
      ...(numericValueIsPresent(row.azucares_100g) ? { azucares: numberValue(row.azucares_100g) * factor } : {}),
      ...(numericValueIsPresent(row.sal_100g) ? { sal: numberValue(row.sal_100g) * factor } : {}),
    },
  });
}

function sourcePriority(sourceType?: string | null) {
  if (sourceType === "manual") return 500;
  if (sourceType === "bedca") return 40;
  if (sourceType === "usda") return 25;
  if (sourceType === "open_food_facts") return 10;
  return 0;
}

function sourceLabelForFoundItem(source: string, sourceType?: string | null) {
  if (source === "productos") return "Base interna";
  if (source === "alimentos_internos") return "Base interna";
  if (source === "tabla_interna") return "Base interna";
  if (source === "alimentos_unificados" && sourceType === "manual") return "Base interna";
  if (source === "alimentos_unificados") return "Base externa";
  if (source === "usda" || source === "fatsecret") return "Base externa";
  return source;
}

function unifiedFoodStateMatches(estado: UnifiedFoodRow["estado"], requestedState: ReturnType<typeof requestedCookingState>) {
  if (!requestedState) return false;
  if (requestedState === "raw") return estado === "crudo" || estado === "natural";
  if (requestedState === "cooked" || requestedState === "boiled" || requestedState === "grilled") return estado === "cocido";
  if (requestedState === "fried") return estado === "procesado";
  return false;
}

function findUnifiedFood(name: string, foods: UnifiedFoodRow[], sourceTypes?: Array<NonNullable<UnifiedFoodRow["source_type"]>>) {
  return findUnifiedFoodByMode(name, foods, sourceTypes, "partial");
}

function findUnifiedFoodByMode(name: string, foods: UnifiedFoodRow[], sourceTypes?: Array<NonNullable<UnifiedFoodRow["source_type"]>>, mode: MatchMode = "partial") {
  const normalized = normalizeName(name);
  const rankingQuery = normalizeFoodRankingText(name);
  const requestedState = requestedCookingState(name);
  const defaultState = defaultCookingStateForBaseFood(name, name);
  const allowedSourceTypes = sourceTypes?.length ? new Set(sourceTypes) : null;

  const candidates = foods
    .filter(food => food.is_active && food.verificado)
    .filter(food => !allowedSourceTypes || allowedSourceTypes.has(food.source_type ?? "manual"))
    .flatMap(food => {
      const keys = [food.nombre, food.nombre_normalizado, ...(food.aliases ?? [])].filter(Boolean);
      return keys.map(key => {
        const normalizedKey = normalizeName(key);
        const rankingKey = normalizeFoodRankingText(key);
        const exact = normalizedKey === normalized || rankingKey === rankingQuery;
        const partial = mode === "partial" && normalizedKey && isReliableFoodNameMatch(key, name);
        const disallowedFoodName =
          normalizeName(food.nombre) !== normalized &&
          normalizeFoodRankingText(food.nombre) !== rankingQuery &&
          (isDisallowedDefaultProcessedMatch(food.nombre, name) || hasFoodCategoryConflict(food.nombre, name, food.categoria));
        const stateBonus = requestedState && unifiedFoodStateMatches(food.estado, requestedState) ? 40 : 0;
        const defaultStateBonus =
          !requestedState &&
          defaultState &&
          unifiedFoodStateMatches(food.estado, defaultState)
            ? 24
            : 0;
        const simplicityBonus = isGenericSimpleFoodQuery(name) && significantFoodTokens(key).length <= significantFoodTokens(name).length + 1 ? 18 : 0;
        return {
          key,
          food,
          normalized: normalizedKey,
          exact,
          partial,
          score: disallowedFoodName
            ? -999
            : (exact ? 120 : partial ? 55 : 0) + stateBonus + defaultStateBonus + simplicityBonus + sourcePriority(food.source_type) + processingScore(food.nombre, name),
        };
      });
    })
    .filter(candidate => candidate.exact || candidate.partial)
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || tokenSimilarity(b.key, name) - tokenSimilarity(a.key, name) || a.normalized.length - b.normalized.length);

  const match = candidates[0];
  return match ? { key: match.key, row: match.food, food: foodFromUnifiedRow(match.food) } : null;
}

function productFoodMacro(row: ProductRow): FoodMacro {
  return {
    kcal: numberValue(row.calories),
    protein: numberValue(row.protein),
    carbs: numberValue(row.carbs),
    fat: numberValue(row.fat),
    fiber: numberValue(row.fiber),
  };
}

function measureFoodMacro(measure: ProductMeasureRow): FoodMacro {
  return {
    kcal: numberValue(measure.calories),
    protein: numberValue(measure.protein),
    carbs: numberValue(measure.carbs),
    fat: numberValue(measure.fat),
    fiber: numberValue(measure.fiber),
  };
}

function findProduct(input: IngredientInput, products: ProductRow[]) {
  const normalizedRaw = normalizeName(String(input.raw ?? ""));
  const normalizedName = normalizeName(String(input.name ?? ""));
  if (isBasicIngredientOnlyQuery(normalizedName) || isBasicIngredientOnlyQuery(normalizedRaw)) return null;
  const searchable = `${normalizedRaw} ${normalizedName}`.trim();
  if (!searchable) return null;

  const matches = products
    .filter(product => product.is_active && product.available_for_recipes && !product.informative_only)
    .map(product => {
      const normalizedProduct = normalizeName(product.name);
      const normalizedSlug = normalizeName(product.slug ?? "");
      const normalizedAliases = (product.aliases ?? []).map(alias => normalizeName(alias)).filter(Boolean);
      const exactProductName = normalizedProduct === normalizedName || normalizedProduct === normalizedRaw;
      const exactProductAlias = normalizedAliases
        .filter(alias => !isBasicIngredientOnlyQuery(alias))
        .some(alias => alias === normalizedName || alias === normalizedRaw);
      const fullProductMentioned = Boolean(normalizedProduct && containsWholeNormalizedPhrase(searchable, normalizedProduct));
      const fullSlugMentioned = Boolean(normalizedSlug && containsWholeNormalizedPhrase(searchable, normalizedSlug));
      const fullAliasMentioned = normalizedAliases
        .filter(alias => !isBasicIngredientOnlyQuery(alias))
        .some(alias => alias && containsWholeNormalizedPhrase(searchable, alias));
      const productMatches =
        (exactProductName ||
          exactProductAlias ||
          fullProductMentioned ||
          fullSlugMentioned ||
          fullAliasMentioned);
      const aliasScore = normalizedAliases
        .filter(alias => !isBasicIngredientOnlyQuery(alias))
        .filter(alias => containsWholeNormalizedPhrase(searchable, alias) || alias === normalizedName || alias === normalizedRaw)
        .sort((a, b) => b.length - a.length)[0]?.length ?? 0;
      return {
        product,
        normalizedProduct,
        score: productMatches ? Math.max(normalizedProduct.length, aliasScore) + (exactProductName || exactProductAlias ? 80 : 0) + (fullProductMentioned ? 30 : 0) : 0,
      };
    })
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches[0]?.product ?? null;
}

function productMeasureQuantity(input: IngredientInput, measure: ProductMeasureRow) {
  const raw = normalizeName(String(input.raw ?? input.name ?? ""));
  const measureName = normalizeName(measure.name);
  if (!measureName || !raw.includes(measureName)) return null;

  const quantityPattern = new RegExp(`(\\d+(?:[,.]\\d+)?)\\s*${measureName.replace(/\s+/g, "\\s+")}\\b`, "i");
  const quantityMatch = raw.match(quantityPattern);
  if (quantityMatch) return Number(quantityMatch[1].replace(",", "."));
  if (measureName.includes("medio")) return 1;
  return input.quantity && normalizeName(input.unit ?? "") === measureName ? Number(input.quantity) : 1;
}

function findProductMeasure(input: IngredientInput, product: ProductRow) {
  const raw = normalizeName(String(input.raw ?? input.name ?? ""));
  const measures = [...(product.product_measures ?? [])].sort((a, b) => {
    const aName = normalizeName(a.name);
    const bName = normalizeName(b.name);
    return bName.length - aName.length || numberValue(a.sort_order) - numberValue(b.sort_order);
  });

  for (const measure of measures) {
    const quantity = productMeasureQuantity(input, measure);
    if (quantity) return { measure, quantity };
  }

  const cacito = measures.find(measure => normalizeName(measure.name) === "cacito");
  if (cacito && raw.includes("medio cacito")) return { measure: cacito, quantity: 0.5 };

  const spoon = measures.find(measure => {
    const name = normalizeName(measure.name);
    return name.includes("cuchara") && (measure.is_default || name.includes("1 cuchara"));
  }) ?? measures.find(measure => normalizeName(measure.name).includes("cuchara"));
  if (spoon && /\b(cuchara|cucharas)\b/.test(raw)) {
    if (/\b(1\s*2|media|medio)\s+cuchara\b/.test(raw)) return { measure: spoon, quantity: 0.5 };
    if (input.quantity && safeLowerCase(input.unit, "inferProductMeasureQuantity.inputUnit").includes("cuchara")) return { measure: spoon, quantity: Number(input.quantity) };
    return { measure: spoon, quantity: 1 };
  }

  const defaultMeasure = measures.find(measure => measure.is_default);
  if (defaultMeasure) return { measure: defaultMeasure, quantity: input.quantity && !input.unit ? Number(input.quantity) : 1 };
  return null;
}

function hasUsableMacros(value: Pick<FoodMacro, "kcal" | "protein" | "carbs" | "fat" | "fiber">) {
  return Boolean(value.kcal || value.protein || value.carbs || value.fat || value.fiber);
}

function calculateProductMacros(input: IngredientInput, product: ProductRow, explicitGrams: number | null) {
  const productMacro = productFoodMacro(product);
  if (explicitGrams && Number.isFinite(explicitGrams) && explicitGrams > 0) {
    if (!hasCompleteVerifiedProductNutrition(product) || !hasUsableMacros(productMacro)) return null;
    return {
      grams: explicitGrams,
      matchedAs: product.name,
      measureName: "100 g",
      macros: scale(productMacro, explicitGrams),
    };
  }

  const measureMatch = findProductMeasure(input, product);
  if (!measureMatch) return null;
  const grams = numberValue(measureMatch.measure.grams) * Math.max(0.01, measureMatch.quantity);
  const measureMacro = measureFoodMacro(measureMatch.measure);
  const hasMeasureMacros = hasCompleteVerifiedMeasureNutrition(measureMatch.measure) && hasUsableMacros(measureMacro);
  if (!hasMeasureMacros && !hasCompleteVerifiedProductNutrition(product)) return null;
  const macros = hasMeasureMacros
    ? {
      kcal: measureMacro.kcal * measureMatch.quantity,
      protein: measureMacro.protein * measureMatch.quantity,
      carbs: measureMacro.carbs * measureMatch.quantity,
      fat: measureMacro.fat * measureMatch.quantity,
      fiber: measureMacro.fiber * measureMatch.quantity,
      micronutrients: {},
    }
    : scale(productMacro, grams);

  return {
    grams,
    matchedAs: product.name,
    measureName: measureMatch.measure.name,
    macros: enforceMacroCalories(macros),
  };
}

function scale(food: FoodMacro, grams: number): MacroValues {
  const factor = grams / 100;
  return enforceMacroCalories({
    kcal: food.kcal * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
    fiber: food.fiber * factor,
    micronutrients: Object.fromEntries(
      Object.entries(food.micronutrients ?? {}).map(([key, value]) => [key, value * factor])
    ),
  });
}

function scaleInternalFood(row: InternalFoodRow, grams: number): MacroValues {
  const nutrition = internalFoodNutrition(row);
  const baseQuantity = Math.max(1, numberValue(row.base_quantity) || 100);
  const factor = grams / baseQuantity;
  return enforceMacroCalories({
    kcal: nutrition.calories * factor,
    protein: nutrition.protein * factor,
    carbs: nutrition.carbs * factor,
    fat: nutrition.fat * factor,
    fiber: nutrition.fiber * factor,
    micronutrients: {
      ...(numericValueIsPresent(nutrition.azucares) ? { azucares: nutrition.azucares * factor } : {}),
      ...(numericValueIsPresent(nutrition.grasas_saturadas) ? { grasas_saturadas: nutrition.grasas_saturadas * factor } : {}),
      ...(numericValueIsPresent(nutrition.sal) ? { sal: nutrition.sal * factor } : {}),
    },
  });
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function zeroMacros(): MacroValues {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, micronutrients: {} };
}

function addMacros(target: MacroValues, value: MacroValues) {
  target.kcal += value.kcal;
  target.protein += value.protein;
  target.carbs += value.carbs;
  target.fat += value.fat;
  target.fiber += value.fiber;
  for (const [key, micronutrientValue] of Object.entries(value.micronutrients ?? {})) {
    target.micronutrients[key] = (target.micronutrients[key] ?? 0) + micronutrientValue;
  }
}

function divideMacros(value: MacroValues, divisor: number): MacroValues {
  const safeDivisor = Math.max(1, divisor);
  return enforceMacroCalories({
    kcal: value.kcal / safeDivisor,
    protein: value.protein / safeDivisor,
    carbs: value.carbs / safeDivisor,
    fat: value.fat / safeDivisor,
    fiber: value.fiber / safeDivisor,
    micronutrients: Object.fromEntries(
      Object.entries(value.micronutrients ?? {}).map(([key, micronutrientValue]) => [key, micronutrientValue / safeDivisor]),
    ),
  });
}

function getFatSecretCredentials() {
  const key = String(process.env.FATSECRET_CONSUMER_KEY || process.env.FATSECRET_CLIENT_ID || "").trim();
  const secret = String(process.env.FATSECRET_CONSUMER_SECRET || process.env.FATSECRET_CLIENT_SECRET || "").trim();
  return key && secret ? { key, secret } : null;
}

function getUsdaApiKey() {
  const key = String(process.env.USDA_API_KEY || "").trim();
  return key || null;
}

const EXPECTED_SUPABASE_REF = "vuvdnmessgwhlggzcfqb";
const EXPECTED_SUPABASE_HOST = `${EXPECTED_SUPABASE_REF}.supabase.co`;

function pickSupabaseUrl(...candidates: Array<string | undefined>) {
  const valid = candidates.filter((url): url is string => /^https:\/\//.test(url ?? ""));
  return valid.find(url => url.includes(EXPECTED_SUPABASE_HOST)) ?? valid[0] ?? "";
}

function getSupabaseConfig() {
  const supabaseUrl = pickSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY;
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

function createSupabaseForToken(token: string) {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function loadInternalFoods(token: string, attempts?: any[]) {
  const supabase = createSupabaseForToken(token);
  if (!supabase) return [];
  const query = (select: string) => (supabase as any)
    .schema("public")
    .from("internal_foods")
    .select(select)
    .eq("is_active", true)
    .order("name", { ascending: true });

  let { data, error } = await query("id,name,synonyms,base_quantity,base_unit,calories,protein,carbs,fat,fiber,salt,azucares_g,grasas_saturadas_g,category,source,is_active");

  if (error && isMissingInternalOptionalNutritionColumn(error)) {
    const withoutNewFields = await query("id,name,synonyms,base_quantity,base_unit,calories,protein,carbs,fat,fiber,salt,category,source,is_active");
    if (!withoutNewFields.error) {
      attempts?.push({
        provider: "alimentos_internos",
        rejected: false,
        reason: "columnas_azucares_grasas_saturadas_pendientes_de_migracion",
        fallback: "campos_opcionales_vacios",
      });
      return (withoutNewFields.data ?? []).map((item: any) => ({ ...item, azucares_g: null, grasas_saturadas_g: null })) as InternalFoodRow[];
    }
    error = withoutNewFields.error;
    data = withoutNewFields.data;
  }

  if (error && isMissingSaltColumn(error)) {
    const legacy = await query("id,name,synonyms,base_quantity,base_unit,calories,protein,carbs,fat,fiber,category,source,is_active");
    if (!legacy.error) {
      attempts?.push({
        provider: "alimentos_internos",
        rejected: false,
        reason: "columna_sal_pendiente_de_migracion",
        fallback: "sal_0_temporal",
      });
      return (legacy.data ?? []).map((item: any) => ({ ...item, salt: 0 })) as InternalFoodRow[];
    }
  }

  if (error) {
    attempts?.push({
      provider: "alimentos_internos",
      rejected: true,
      reason: "no_se_pudo_leer_tabla",
      error: error.message,
      fallback: "base_interna_integrada",
    });
    return INITIAL_INTERNAL_FOODS as InternalFoodRow[];
  }
  return (data ?? []) as InternalFoodRow[];
}

async function loadUnifiedFoods(token: string, attempts?: any[]) {
  const supabase = createSupabaseForToken(token);
  if (!supabase) return [];
  const unified = await (supabase as any)
    .schema("public")
    .from("food_items")
    .select("id,source_type,source_id,nombre,nombre_normalizado,aliases,categoria,estado,kcal_100g,proteina_100g,hidratos_100g,grasa_100g,fibra_100g,azucares_100g,sal_100g,fuente,verificado,is_active,raw_data")
    .eq("is_active", true)
    .eq("verificado", true)
    .order("source_type", { ascending: true })
    .order("nombre", { ascending: true });

  if (!unified.error) return (unified.data ?? []) as UnifiedFoodRow[];

  attempts?.push({
    provider: "alimentos_unificados",
    rejected: true,
    reason: "no_se_pudo_leer_food_items",
    error: unified.error.message,
    fallback: "usda_fatsecret_alimentos_internos",
  });

  return [];
}

async function loadProducts(token: string, attempts?: any[]) {
  const supabase = createSupabaseForToken(token);
  if (!supabase) return [];
  const { data, error } = await (supabase as any)
    .schema("public")
    .from("products")
    .select("id,name,slug,aliases,source,verification_status,calories,protein,carbs,fat,fiber,is_active,available_for_recipes,informative_only,product_measures(id,name,grams,calories,protein,carbs,fat,fiber,source,verification_status,is_default,sort_order)")
    .eq("is_active", true)
    .eq("available_for_recipes", true)
    .eq("informative_only", false)
    .order("name", { ascending: true });

  if (error) {
    attempts?.push({
      provider: "productos",
      rejected: true,
      reason: "no_se_pudo_leer_tabla",
      error: error.message,
      fallback: "usda_fatsecret_alimentos_internos",
    });
    return [];
  }
  return ((data ?? []) as ProductRow[]).filter(product => {
    if (hasCompleteVerifiedProductNutrition(product)) return true;
    return (product.product_measures ?? []).some(hasCompleteVerifiedMeasureNutrition);
  });
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

function numericValueIsPresent(value: any) {
  if (value === null || value === undefined || value === "") return false;
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n);
}

function firstNumericValue(row: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (numericValueIsPresent(row?.[key])) return numberValue(row[key]);
  }
  return 0;
}

function internalFoodNutrition(row: InternalFoodRow) {
  const source = row as unknown as Record<string, any>;
  return {
    calories: firstNumericValue(source, ["calories", "calorias", "calorias_kcal", "kcal", "energia", "energia_kcal"]),
    protein: firstNumericValue(source, ["protein", "proteinas", "proteinas_g", "proteina", "proteina_g"]),
    carbs: firstNumericValue(source, ["carbs", "hidratos", "hidratos_g", "hidratos_de_carbono", "carbohidratos"]),
    fat: firstNumericValue(source, ["fat", "grasas", "grasas_g", "grasa", "grasa_g"]),
    fiber: firstNumericValue(source, ["fiber", "fibra", "fibra_g"]),
    azucares: firstNumericValue(source, ["azucares_g", "azucares", "azucares_9", "azucares_totales"]),
    grasas_saturadas: firstNumericValue(source, ["grasas_saturadas_g", "grasas_saturadas", "saturadas"]),
    sal: firstNumericValue(source, ["salt", "sal", "sal_g"]),
  };
}

function isMissingSaltColumn(error: any) {
  const message = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`;
  return /salt/i.test(message) && /column|schema|cache|find|exist/i.test(message);
}

function isMissingInternalOptionalNutritionColumn(error: any) {
  const message = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`;
  return /(azucares_g|azucares_9|grasas_saturadas_g)/i.test(message) && /column|schema|cache|find|exist/i.test(message);
}

function hasCompleteVerifiedProductNutrition(product: ProductRow) {
  if (product.verification_status !== "verificado") return false;
  return [product.calories, product.protein, product.carbs, product.fat, product.fiber].every(numericValueIsPresent);
}

function hasCompleteVerifiedMeasureNutrition(measure: ProductMeasureRow) {
  if (measure.verification_status !== "verificado") return false;
  return [measure.grams, measure.calories, measure.protein, measure.carbs, measure.fat, measure.fiber].every(numericValueIsPresent);
}

function servingToMacros(serving: any, amount: number): MacroValues | null {
  const metricAmount = numberValue(serving?.metric_serving_amount);
  const metricUnit = safeLowerCase(serving?.metric_serving_unit, "servingToMacros.metricUnit");
  if (!metricAmount || !["g", "ml"].includes(metricUnit)) return null;

  const factor = amount / metricAmount;
  return enforceMacroCalories({
    kcal: numberValue(serving?.calories) * factor,
    protein: numberValue(serving?.protein) * factor,
    carbs: numberValue(serving?.carbohydrate) * factor,
    fat: numberValue(serving?.fat) * factor,
    fiber: numberValue(serving?.fiber) * factor,
    micronutrients: {},
  });
}

function isBadLowFatMilkMatch(query: string, matchedName: string, macros: MacroValues, amount: number) {
  const normalizedQuery = normalizeName(query);
  const normalizedMatch = normalizeName(matchedName);
  const asksForLowFatMilk = /\b(leche desnatada|leche descremada|leche sin grasa|skim milk|nonfat milk)\b/.test(normalizedQuery);
  if (!asksForLowFatMilk) return false;
  if (!/\b(leche|milk)\b/.test(normalizedMatch)) return true;
  const maxExpectedFat = Math.max(0.5, amount * 0.005);
  return (normalizedMatch === "leche" || normalizedMatch === "milk") && macros.fat > maxExpectedFat;
}

function hasRankingTerm(value: string, pattern: RegExp) {
  return pattern.test(normalizeFoodRankingText(value));
}

function asksForFriedOrProcessedFood(query: string) {
  return hasRankingTerm(query, /\b(frito|frita|fritos|fritas|fried|fries|french fries|chips|chip|crisps|snack|empanado|rebozado|breaded|battered)\b/);
}

function asksForPreparedFood(query: string) {
  return asksForFriedOrProcessedFood(query) ||
    hasRankingTerm(query, /\b(preparado|preparada|plato|receta|salsa|sauce|sandwich|pizza|ensalada|salad|burger|hamburguesa|with|and|con|y|mixed|mix|mixto|mezcla|cookie|cookies|bread|cake|cereal|snack|crackers|biscuit|barrita|barritas|dulce|pan|galleta|galletas)\b/);
}

function asksForBrothFood(query: string) {
  return hasRankingTerm(query, /\b(caldo|broth|stock)\b/);
}

function asksForDerivedFood(query: string) {
  return hasRankingTerm(query, /\b(flour|powder|starch|flakes|instant|concentrate|extract|dehydrated|dried|harina|fecula|fécula|almidon|almidón|polvo|copos|instantaneo|instantáneo|concentrado|extracto|deshidratado|deshidratada|seco|seca|secos|secas)\b/);
}

function requestedCookingState(query: string): "raw" | "cooked" | "boiled" | "grilled" | "fried" | null {
  if (hasRankingTerm(query, /\b(frito|frita|fritos|fritas|fried|fries)\b/)) return "fried";
  if (hasRankingTerm(query, /\b(plancha|grilled|grill)\b/)) return "grilled";
  if (hasRankingTerm(query, /\b(hervido|hervida|boiled)\b/)) return "boiled";
  if (hasRankingTerm(query, /\b(cocido|cocida|cooked|asado|asada|roasted|baked|horno)\b/)) return "cooked";
  if (hasRankingTerm(query, /\b(crudo|cruda|raw|natural|fresco|fresca|fresh)\b/)) return "raw";
  return null;
}

function defaultCookingStateForBaseFood(baseFood: string, originalQuery: string): "raw" | "cooked" | "boiled" | "grilled" | "fried" | null {
  const requested = requestedCookingState(originalQuery);
  if (requested) return requested;
  const base = normalizeFoodRankingText(baseFood);
  if (base.includes("rice")) return "cooked";
  if (base.includes("potato")) return "boiled";
  if (base.includes("chicken") || base.includes("turkey")) return "cooked";
  return null;
}

function qualifySearchCandidate(baseFood: string, originalQuery: string) {
  const state = defaultCookingStateForBaseFood(baseFood, originalQuery);
  if (!state) return baseFood;
  if (state === "boiled") return `${baseFood} boiled`;
  if (state === "grilled") return `${baseFood} grilled`;
  if (state === "fried") return `${baseFood} fried`;
  return `${baseFood} ${state}`;
}

function readableMatchedFoodLabel(providerName: string, originalQuery: string) {
  const provider = String(providerName || "").trim();
  const normalizedProvider = normalizeFoodRankingText(provider);
  const normalizedQuery = normalizeFoodRankingText(originalQuery);
  const state = requestedCookingState(originalQuery) ??
    (isFriedOrUltraProcessedFoodName(provider) ? "fried" :
      isRawOrPlainFoodName(provider) ? "raw" :
        hasRankingTerm(provider, /\b(boiled|hervido|hervida)\b/) ? "boiled" :
          isCookedSimpleFoodName(provider) ? "cooked" : null);

  let label = "";
  if (/\b(rice|arroz)\b/.test(normalizedProvider) || /\barroz\b/.test(normalizedQuery)) {
    label = state === "raw" ? "arroz blanco crudo" : "arroz blanco cocido";
  } else if (/\b(potato|patata|papa)\b/.test(normalizedProvider) || /\b(patata|papa)\b/.test(normalizedQuery)) {
    label = state === "fried" ? "patata frita" : state === "raw" ? "patata cruda" : "patata cocida";
  } else if (/\b(chicken broth|broth chicken|caldo pollo)\b/.test(normalizedProvider) || /\bcaldo pollo\b/.test(normalizedQuery)) {
    label = normalizedQuery.includes("bajo sal") || normalizedQuery.includes("bajo en sal") ? "caldo de pollo bajo en sal" : "caldo de pollo";
  } else if (/\b(vegetable broth|broth vegetable|caldo verduras)\b/.test(normalizedProvider) || /\bcaldo verduras\b/.test(normalizedQuery)) {
    label = normalizedQuery.includes("bajo sal") || normalizedQuery.includes("bajo en sal") ? "caldo de verduras bajo en sal" : "caldo de verduras";
  } else if (/\b(beef broth|broth beef|caldo carne|caldo ternera)\b/.test(normalizedProvider) || /\bcaldo (carne|ternera)\b/.test(normalizedQuery)) {
    const base = normalizedQuery.includes("caldo ternera") ? "caldo de ternera" : "caldo de carne";
    label = normalizedQuery.includes("bajo sal") || normalizedQuery.includes("bajo en sal") ? `${base} bajo en sal` : base;
  } else if (/\b(chicken|pollo)\b/.test(normalizedProvider) || /\bpollo\b/.test(normalizedQuery)) {
    label = state === "raw" ? "pechuga de pollo cruda" : state === "grilled" ? "pechuga de pollo a la plancha" : "pechuga de pollo cocinada";
  } else if (/\b(beef|ternera|vacuno)\b/.test(normalizedProvider) || /\b(ternera|vacuno)\b/.test(normalizedQuery)) {
    label = state === "raw" ? "ternera cruda" : state === "grilled" ? "ternera a la plancha" : "ternera";
  } else if (/\b(cornstarch|corn starch|maicena|almidon maiz|fecula maiz)\b/.test(normalizedProvider) || /\b(maicena|almidon maiz|fecula maiz)\b/.test(normalizedQuery)) {
    label = "maicena";
  } else if (/\b(garlic|ajo)\b/.test(normalizedProvider) || /\bajo\b/.test(normalizedQuery)) {
    label = "ajo";
  } else if (/\b(tomato|tomate)\b/.test(normalizedProvider) || /\btomate\b/.test(normalizedQuery)) {
    label = state === "cooked" || state === "boiled" ? "tomate cocinado" : "tomate natural";
  } else if (/\b(zucchini|calabacin|calabacín)\b/.test(normalizedProvider) || /\bcalabacin\b/.test(normalizedQuery)) {
    label = state === "cooked" || state === "boiled" || state === "grilled" ? "calabacín cocinado" : "calabacín crudo";
  } else if (/\b(carrot|zanahoria)\b/.test(normalizedProvider) || /\bzanahoria\b/.test(normalizedQuery)) {
    label = state === "cooked" || state === "boiled" ? "zanahoria cocida" : "zanahoria cruda";
  } else if (/\b(onion|cebolla)\b/.test(normalizedProvider) || /\bcebolla\b/.test(normalizedQuery)) {
    label = state === "cooked" || state === "grilled" ? "cebolla cocinada" : "cebolla cruda";
  } else if (/\b(mushroom|mushrooms|setas|champinon|champinones|champiñon|champiñones)\b/.test(normalizedProvider) || /\b(setas|champinones|champiñones)\b/.test(normalizedQuery)) {
    label = "champiñones";
  } else if (/\b(oats|oat|avena)\b/.test(normalizedProvider) || /\bavena\b/.test(normalizedQuery)) {
    label = "copos de avena";
  } else if (/\b(apple|manzana)\b/.test(normalizedProvider) || /\bmanzana\b/.test(normalizedQuery)) {
    label = "manzana";
  } else if (/\b(banana|plantain|platano|plátano)\b/.test(normalizedProvider) || /\b(platano|banana)\b/.test(normalizedQuery)) {
    label = "plátano";
  } else if (/\b(olive oil|aceite oliva)\b/.test(normalizedProvider) || /\baceite oliva\b/.test(normalizedQuery)) {
    label = "aceite de oliva";
  }

  if (!label) return provider || originalQuery;
  return label;
}

function isFriedOrUltraProcessedFoodName(foodName: string) {
  return hasRankingTerm(foodName, /\b(fried|fries|french fries|chips|chip|crisps|snack|frito|frita|fritos|fritas|empanado|empanada|rebozado|rebozada|breaded|battered)\b/);
}

function isPreparedFoodName(foodName: string) {
  return hasRankingTerm(foodName, /\b(prepared|recipe|dish|meal|restaurant|fast food|sandwich|pizza|burger|hamburger|casserole|sauce|dressing|mayonnaise|salad|soup|with|and|mixed|mix|mixture|blend|preparado|preparada|plato|receta|salsa|ensalada|mayonesa|sopa|con|y|mixto|mixta|mezcla)\b/);
}

function isCommercialOrPackagedFoodName(foodName: string) {
  return hasRankingTerm(foodName, /\b(cookie|cookies|bread|cake|cakes|cereal|cereals|snack|snacks|chips|crackers|cracker|biscuit|biscuits|bar|bars|barrita|barritas|dulce|dulces|pan|galleta|galletas|bolleria|bolleria|pastry|pastries|candy|candies|syrup|drink|beverage|bebida|zumo|juice|product|commercial|brand|branded)\b/);
}

function isDerivedFoodName(foodName: string) {
  return hasRankingTerm(foodName, /\b(flour|powder|starch|flakes|instant|concentrate|extract|dehydrated|dried|harina|fecula|fécula|almidon|almidón|polvo|copos|instantaneo|instantáneo|concentrado|extracto|deshidratado|deshidratada|seco|seca|secos|secas)\b/);
}

function isCookedSimpleFoodName(foodName: string) {
  return hasRankingTerm(foodName, /\b(cooked|boiled|steamed|baked|roasted|grilled|broiled|hervido|hervida|cocido|cocida|asado|asada|horno|vapor|plancha)\b/);
}

function isRawOrPlainFoodName(foodName: string) {
  return hasRankingTerm(foodName, /\b(raw|fresh|uncooked|crudo|cruda|fresco|fresca)\b/);
}

function cookingStateScore(foodName: string, query: string) {
  const requested = requestedCookingState(query);
  if (!requested) return 0;
  if (requested === "raw") return isRawOrPlainFoodName(foodName) ? 70 : isCookedSimpleFoodName(foodName) ? -30 : 0;
  if (requested === "fried") return isFriedOrUltraProcessedFoodName(foodName) ? 70 : -40;
  if (requested === "grilled") return hasRankingTerm(foodName, /\b(grilled|grill|plancha)\b/) ? 70 : 0;
  if (requested === "boiled") return hasRankingTerm(foodName, /\b(boiled|hervido|hervida)\b/) ? 70 : isCookedSimpleFoodName(foodName) ? 35 : 0;
  if (requested === "cooked") return isCookedSimpleFoodName(foodName) ? 55 : isRawOrPlainFoodName(foodName) ? -15 : 0;
  return 0;
}

function isGenericSimpleFoodQuery(query: string) {
  if (asksForPreparedFood(query)) return false;
  if (asksForDerivedFood(query)) return false;
  const tokens = significantFoodTokens(query);
  return tokens.length > 0 && tokens.length <= 3;
}

function hasCompositeConnector(foodName: string) {
  return hasRankingTerm(foodName, /\b(with|and|plus|mixed|mixture|blend|combination|con|y|e|mixto|mixta|mezcla)\b/);
}

function hasExtraFoodAfterConnector(foodName: string, query: string) {
  if (!isGenericSimpleFoodQuery(query)) return false;
  return hasCompositeConnector(foodName);
}

function processingScore(foodName: string, query: string) {
  const explicitFried = asksForFriedOrProcessedFood(query);
  const explicitPrepared = asksForPreparedFood(query);
  const explicitDerived = asksForDerivedFood(query);
  const fried = isFriedOrUltraProcessedFoodName(foodName);
  const prepared = isPreparedFoodName(foodName);
  const commercial = isCommercialOrPackagedFoodName(foodName);
  const derived = isDerivedFoodName(foodName);
  const cooked = isCookedSimpleFoodName(foodName);
  const raw = isRawOrPlainFoodName(foodName);

  if (fried && !explicitFried) return -180;
  if (fried && explicitFried) return 28;
  if (derived && isGenericSimpleFoodQuery(query) && !explicitDerived) return -220;
  if (derived && explicitDerived) return 30;
  if (hasExtraFoodAfterConnector(foodName, query) && !explicitPrepared) return -160;
  if (commercial && isGenericSimpleFoodQuery(query) && !explicitPrepared) return -140;
  if (prepared && !explicitPrepared) return -70;
  if (prepared && explicitPrepared) return 16;
  if (raw) return 34;
  if (cooked) return 24;

  const normalized = normalizeFoodRankingText(foodName);
  const tokenCount = normalized.split(" ").filter(Boolean).length;
  if (tokenCount <= 3) return 22;
  return 0;
}

function isDisallowedDefaultProcessedMatch(foodName: string, query: string) {
  if (asksForPreparedFood(query)) return false;
  if (asksForDerivedFood(query)) return false;
  const brothQuery = asksForBrothFood(query);
  return isFriedOrUltraProcessedFoodName(foodName) ||
    (isGenericSimpleFoodQuery(query) && isDerivedFoodName(foodName)) ||
    (!brothQuery && isPreparedFoodName(foodName)) ||
    (isGenericSimpleFoodQuery(query) && isCommercialOrPackagedFoodName(foodName)) ||
    hasExtraFoodAfterConnector(foodName, query);
}

function isCommercialProviderFood(food: any, query: string) {
  if (!isGenericSimpleFoodQuery(query) || asksForPreparedFood(query)) return false;
  const type = normalizeFoodRankingText(String(food?.food_type ?? food?.foodType ?? food?.type ?? ""));
  const brand = normalizeFoodRankingText(String(food?.brand_name ?? food?.brandName ?? food?.brand ?? ""));
  return Boolean(brand) || /\b(brand|branded|commercial|restaurant|generic meal)\b/.test(type);
}

function macrosPer100(macros: MacroValues, grams: number): MacroValues {
  const factor = grams > 0 ? 100 / grams : 1;
  return {
    kcal: macros.kcal * factor,
    protein: macros.protein * factor,
    carbs: macros.carbs * factor,
    fat: macros.fat * factor,
    fiber: macros.fiber * factor,
    micronutrients: {},
  };
}

function macroCompatibilityIssueForSimpleFood(query: string, macros: MacroValues, grams: number) {
  if (!isGenericSimpleFoodQuery(query)) return null;
  if (asksForPreparedFood(query) || asksForDerivedFood(query)) return null;
  const expected = findFood(query)?.food;
  if (!expected || !grams || grams <= 0) return null;

  const per100 = macrosPer100(macros, grams);
  const expectedKcal = Number(expected.kcal) || 0;
  const expectedProtein = Number(expected.protein) || 0;
  const expectedFat = Number(expected.fat) || 0;

  if (expectedKcal > 0 && expectedKcal < 100) {
    const maxKcal = Math.max(160, expectedKcal * 4);
    const maxProtein = Math.max(12, expectedProtein * 8);
    const maxFat = Math.max(8, expectedFat * 20 + 5);
    if (per100.kcal > maxKcal || per100.protein > maxProtein || per100.fat > maxFat) {
      return {
        reason: "macros_incompatibles_con_alimento_simple",
        expectedPer100: { kcal: expectedKcal, protein: expectedProtein, fat: expectedFat },
        receivedPer100: roundMacros(per100),
      };
    }
  }

  const maxKcal = Math.max(220, expectedKcal * 4);
  if (expectedKcal > 0 && per100.kcal > maxKcal) {
    return {
      reason: "calorias_demasiado_altas_para_alimento_simple",
      expectedPer100: { kcal: expectedKcal, protein: expectedProtein, fat: expectedFat },
      receivedPer100: roundMacros(per100),
    };
  }

  return null;
}

function requiresExactFatSecretMatch(query: string) {
  return ["aceite oliva", "olive oil", "extra virgin olive oil"].includes(normalizeName(query));
}

function isBasicFoodForUsda(query: string) {
  const normalized = normalizeName(query);
  if (findFood(normalized)) return true;
  return [
    "pollo", "chicken", "pavo", "turkey", "carne", "beef", "cerdo", "pork",
    "pescado", "fish", "lubina", "merluza", "salmon", "atun", "hake", "bass", "tuna",
    "huevo", "egg", "tomate", "brocoli", "calabacin", "zanahoria", "lechuga", "espinacas", "cebolla", "onion", "ajo", "garlic",
    "fruta", "fresa", "platano", "manzana", "arroz", "rice", "pasta",
    "maicena", "cornstarch", "caldo", "broth", "champiñones", "champinones", "mushroom",
    "garbanzo", "lenteja", "aceite oliva", "olive oil",
    "leche", "milk", "yogur", "yogurt", "queso", "cheese",
  ].some(token => normalized.includes(token));
}

function usdaSearchCandidates(name: string) {
  const normalized = normalizeName(name);
  const translations: Array<[RegExp, string]> = [
    [/\baceite\s+oliva\b/, "olive oil"],
    [/\bcaldo\s+pollo\b.*\bbajo\s+en?\s+sal\b/, "low sodium chicken broth"],
    [/\bcaldo\s+(carne|ternera)\b.*\bbajo\s+en?\s+sal\b/, "low sodium beef broth"],
    [/\bcaldo\s+verduras\b.*\bbajo\s+en?\s+sal\b/, "low sodium vegetable broth"],
    [/\bcaldo\s+pollo\b/, "chicken broth"],
    [/\bcaldo\s+verduras\b/, "vegetable broth"],
    [/\bcaldo\s+ternera\b|\bcaldo\s+carne\b/, "beef broth"],
    [/\bpechuga\s+pollo\b|\bpollo\b/, "chicken breast"],
    [/\bpechuga\s+pavo\b|\bpavo\b/, "turkey breast"],
    [/\bternera\b|\bcarne\s+ternera\b|\bvacuno\b/, "beef"],
    [/\bmaicena\b|\bfecula\s+maiz\b|\balmidon\s+maiz\b/, "cornstarch"],
    [/\bajo\b|\bajos\b/, "garlic"],
    [/\bhuevo\b|\bhuevos\b/, "egg"],
    [/\blubina\b|\brobalo\b/, "sea bass"],
    [/\bmerluza\b/, "hake"],
    [/\bsalmon\b/, "salmon"],
    [/\batun\b/, "tuna"],
    [/\bbrocoli\b/, "broccoli"],
    [/\bcalabacin\b/, "zucchini"],
    [/\btomate\b/, "tomato"],
    [/\bcebolla\b/, "onion"],
    [/\bzanahoria\b/, "carrot"],
    [/\blechuga\b/, "lettuce"],
    [/\bespinacas\b/, "spinach"],
    [/\barroz\s+integral\b/, "brown rice"],
    [/\barroz\b/, "rice"],
    [/\bpasta\b/, "pasta"],
    [/\bpatatas?\b|\bpapas?\b/, "potato"],
    [/\bgarbanzos?\b/, "chickpeas"],
    [/\blentejas?\b/, "lentils"],
    [/\bleche\s+desnatada\b|\bleche\s+descremada\b|\bleche\s+sin\s+grasa\b/, "skim milk"],
    [/\bleche\b/, "milk"],
    [/\byogur\s+griego\b/, "greek yogurt"],
    [/\byogur\b/, "plain yogurt"],
    [/\bqueso\s+fresco\b/, "fresh cheese"],
    [/\bfresas?\b/, "strawberries"],
    [/\bplatano\b|\bbanana\b/, "banana"],
    [/\bmanzana\b/, "apple"],
    [/\baguacate\b/, "avocado"],
    [/\bavena\b/, "oats"],
    [/\bquinoa\b/, "quinoa"],
    [/\bchampiñones\b|\bchampinones\b|\bsetas\b|\bhongos\b/, "mushrooms"],
  ];
  const translated = translations.find(([pattern]) => pattern.test(normalized))?.[1];
  const qualifiedTranslated = translated ? qualifySearchCandidate(translated, name) : undefined;
  return Array.from(new Set([qualifiedTranslated, translated, name, cleanSearchName(name)].filter(Boolean).map(String)));
}

function localizedSearchCandidate(name: string) {
  const normalized = normalizeName(name);
  const state = requestedCookingState(name);
  if (/\bcaldo\s+pollo\b.*\bbajo\s+en?\s+sal\b/.test(normalized)) return "caldo de pollo bajo en sal";
  if (/\bcaldo\s+(carne|ternera)\b.*\bbajo\s+en?\s+sal\b/.test(normalized)) return normalized.includes("ternera") ? "caldo de ternera bajo en sal" : "caldo de carne bajo en sal";
  if (/\bcaldo\s+verduras\b.*\bbajo\s+en?\s+sal\b/.test(normalized)) return "caldo de verduras bajo en sal";
  if (/\bcaldo\s+pollo\b/.test(normalized)) return "caldo de pollo";
  if (/\bcaldo\s+verduras\b/.test(normalized)) return "caldo de verduras";
  if (/\bcaldo\s+ternera\b/.test(normalized)) return "caldo de ternera";
  if (/\bcaldo\s+carne\b/.test(normalized)) return "caldo de carne";
  if (/\barroz\b/.test(normalized)) return state === "raw" ? "arroz crudo" : "arroz cocido";
  if (/\bpatatas?\b|\bpapas?\b/.test(normalized)) {
    if (state === "fried") return "patata frita";
    if (state === "raw") return "patata cruda";
    return "patata cocida";
  }
  if (/\bpollo\b|\bpechuga\s+pollo\b/.test(normalized)) {
    if (state === "raw") return "pechuga de pollo cruda";
    if (state === "grilled") return "pechuga de pollo a la plancha";
    return "pechuga de pollo cocinada";
  }
  if (/\bternera\b|\bcarne\s+ternera\b|\bvacuno\b/.test(normalized)) return "ternera";
  if (/\bmaicena\b|\bfecula\s+maiz\b|\balmidon\s+maiz\b/.test(normalized)) return "maicena";
  if (/\bajo\b|\bajos\b/.test(normalized)) return "ajo";
  if (/\btomate\b/.test(normalized) && !state) return "tomate natural";
  if (/\bcalabacin\b/.test(normalized) && !state) return "calabacín crudo";
  if (/\bzanahoria\b/.test(normalized) && !state) return "zanahoria cruda";
  if (/\bcebolla\b/.test(normalized) && !state) return "cebolla";
  if (/\bchampiñones\b|\bchampinones\b|\bsetas\b|\bhongos\b/.test(normalized) && !state) return "champiñones";
  return undefined;
}

function nutrientValue(food: any, nutrientNames: string[]) {
  const nutrients = asArray(food?.foodNutrients);
  const found = nutrients.find((item: any) => {
    const name = normalizeName(item?.nutrientName ?? item?.nutrient?.name ?? "");
    return nutrientNames.some(expected => {
      const normalizedExpected = normalizeName(expected);
      return name === normalizedExpected || name.includes(normalizedExpected);
    });
  });
  return numberValue(found?.value ?? found?.amount);
}

const USDA_MICRONUTRIENTS: Record<string, string[]> = {
  calcium_mg: ["Calcium, Ca", "Calcium"],
  iron_mg: ["Iron, Fe", "Iron"],
  magnesium_mg: ["Magnesium, Mg", "Magnesium"],
  phosphorus_mg: ["Phosphorus, P", "Phosphorus"],
  potassium_mg: ["Potassium, K", "Potassium"],
  sodium_mg: ["Sodium, Na", "Sodium"],
  zinc_mg: ["Zinc, Zn", "Zinc"],
  copper_mg: ["Copper, Cu", "Copper"],
  manganese_mg: ["Manganese, Mn", "Manganese"],
  selenium_ug: ["Selenium, Se", "Selenium"],
  vitamin_a_rae_ug: ["Vitamin A, RAE"],
  vitamin_c_mg: ["Vitamin C, total ascorbic acid", "Vitamin C"],
  vitamin_d_ug: ["Vitamin D (D2 + D3)", "Vitamin D"],
  vitamin_e_mg: ["Vitamin E (alpha-tocopherol)", "Vitamin E"],
  vitamin_k_ug: ["Vitamin K (phylloquinone)", "Vitamin K"],
  thiamin_mg: ["Thiamin"],
  riboflavin_mg: ["Riboflavin"],
  niacin_mg: ["Niacin"],
  vitamin_b6_mg: ["Vitamin B-6"],
  folate_dfe_ug: ["Folate, DFE"],
  vitamin_b12_ug: ["Vitamin B-12"],
  choline_mg: ["Choline, total", "Choline"],
};

function usdaMicronutrients(food: any, factor: number) {
  return Object.fromEntries(
    Object.entries(USDA_MICRONUTRIENTS)
      .map(([key, names]) => [key, nutrientValue(food, names) * factor])
      .filter(([, value]) => Number(value) > 0),
  );
}

function usdaFoodToMacros(food: any, amount: number): MacroValues | null {
  const calories = nutrientValue(food, ["Energy", "Energy (Atwater General Factors)", "Energy (Atwater Specific Factors)"]);
  const protein = nutrientValue(food, ["Protein"]);
  const carbs = nutrientValue(food, ["Carbohydrate, by difference", "Carbohydrate"]);
  const fat = nutrientValue(food, ["Total lipid (fat)", "Total lipid", "fat"]);
  const fiber = nutrientValue(food, ["Fiber, total dietary", "Fiber"]);
  if (!protein && !carbs && !fat && !fiber) return null;

  const factor = amount / 100;
  return enforceMacroCalories({
    kcal: calories * factor,
    protein: protein * factor,
    carbs: carbs * factor,
    fat: fat * factor,
    fiber: fiber * factor,
    micronutrients: usdaMicronutrients(food, factor),
  });
}

function isAllowedUsdaFood(food: any, query: string) {
  const description = normalizeName(food?.description ?? "");
  const dataType = safeLowerCase(food?.dataType, "isAllowedUsdaFood.dataType");
  const normalizedQuery = normalizeName(query);
  if (!description) return false;
  if (dataType.includes("branded")) return false;
  if (isCommercialProviderFood(food, query)) return false;

  if (requiresExactFatSecretMatch(query)) {
    const isOliveOil = description === "olive oil" || description.startsWith("oil olive") || description.startsWith("olive oil");
    const forbidden = /\b(tuna|sardine|fish|chicken|mayonnaise|sauce|meal|sandwich|pasta|rice|vegetable oil spread|dressing)\b/.test(description);
    return isOliveOil && !forbidden;
  }

  if (isDisallowedDefaultProcessedMatch(food?.description ?? "", query)) return false;

  const compositeWords = /\b(soup|sandwich|pizza|restaurant|fast food|meal|dish|recipe|with sauce|in sauce|breaded|casserole|salad dressing|mayonnaise)\b/;
  if (compositeWords.test(description) && !asksForPreparedFood(query) && !asksForBrothFood(query)) return false;

  return description === normalizedQuery || isReliableFoodNameMatch(description, normalizedQuery);
}

function scoreUsdaFood(food: any, query: string) {
  const description = normalizeName(food?.description ?? "");
  const normalizedQuery = normalizeName(query);
  const dataType = safeLowerCase(food?.dataType, "scoreUsdaFood.dataType");
  let score = scoreFood({ food_name: description }, normalizedQuery);
  score += cookingStateScore(food?.description ?? description, query);
  if (description === normalizedQuery) score += 80;
  if (dataType.includes("foundation")) score += 18;
  if (dataType.includes("sr legacy")) score += 15;
  if (dataType.includes("survey")) score += 5;
  score += processingScore(food?.description ?? description, query);
  return score;
}

async function searchUsdaFood(name: string, grams: number, attempts?: any[]): Promise<ProviderMacroMatch | null> {
  const apiKey = getUsdaApiKey();
  if (!apiKey) return null;

  const candidates = usdaSearchCandidates(name);
  for (const query of candidates) {
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", "12");
    url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS)");

    try {
      const response = await fetch(url);
      const text = await response.text();
      if (!response.ok) {
        attempts?.push({ provider: "usda", query, rejected: true, reason: `http_${response.status}`, detail: text.slice(0, 240), fallback: "fatsecret" });
        continue;
      }

      const payload = JSON.parse(text);
      const foods = asArray(payload?.foods);
      const allowed = foods.filter(food => isAllowedUsdaFood(food, query));
      attempts?.push({
        provider: "usda",
        query,
        resultCount: foods.length,
        acceptedCount: allowed.length,
        rejected: foods
          .filter(food => !isAllowedUsdaFood(food, query))
          .slice(0, 6)
          .map(food => ({ fdcId: food?.fdcId, description: food?.description, dataType: food?.dataType })),
      });

      if (!allowed.length) continue;
      const best = allowed
        .map(food => ({ food, score: scoreUsdaFood(food, query) }))
        .sort((a, b) => b.score - a.score)[0];
      if (!best || best.score < 18) {
        attempts?.push({ provider: "usda", query, rejected: true, reason: "score_bajo", bestScore: best?.score ?? 0, bestName: best?.food?.description ?? null, fallback: "fatsecret" });
        continue;
      }

      const macros = usdaFoodToMacros(best.food, grams);
      if (!macros) {
        attempts?.push({ provider: "usda", query, rejected: true, reason: "sin_macros_validos", matchedAs: best.food?.description ?? query, fallback: "fatsecret" });
        continue;
      }
      const compatibilityIssue = macroCompatibilityIssueForSimpleFood(name, macros, grams);
      if (compatibilityIssue) {
        attempts?.push({
          provider: "usda",
          query,
          rejected: true,
          matchedAs: best.food?.description ?? query,
          ...compatibilityIssue,
          fallback: "fatsecret",
        });
        continue;
      }

      attempts?.push({
        provider: "usda",
        query,
        used: true,
        matchedAs: readableMatchedFoodLabel(best.food?.description ?? query, name),
        providerMatchedAs: best.food?.description ?? query,
        fdcId: best.food?.fdcId,
        dataType: best.food?.dataType,
        macros: roundMacros(macros),
      });

      return {
        provider: "usda",
        matchedAs: readableMatchedFoodLabel(best.food?.description ?? query, name),
        displayName: readableMatchedFoodLabel(best.food?.description ?? query, name),
        providerMatchedAs: best.food?.description ?? query,
        foodId: best.food?.fdcId ? String(best.food.fdcId) : undefined,
        macros,
      };
    } catch (err: any) {
      attempts?.push({ provider: "usda", query, rejected: true, reason: "error", error: err?.message || String(err), fallback: "fatsecret" });
    }
  }

  attempts?.push({
    provider: "usda",
    query: name,
    rejected: true,
    reason: "sin_coincidencia_valida",
    fallback: "fatsecret",
  });
  return null;
}

function isAllowedExactOliveOilName(foodName: string) {
  const normalized = normalizeName(foodName);
  return [
    "olive oil",
    "aceite oliva",
    "extra virgin olive oil",
  ].includes(normalized);
}

function filterAllowedProviderFoods(foods: any[], query: string, attempts?: any[], provider?: string) {
  if (!requiresExactFatSecretMatch(query)) {
    const allowedFoods = foods.filter(food =>
      !isCommercialProviderFood(food, query) &&
      !isDisallowedDefaultProcessedMatch(food?.food_name ?? "", query),
    );
    const rejected = foods.filter(food => !allowedFoods.includes(food));
    if (rejected.length) {
      attempts?.push({
        provider,
        query,
        rankingRule: "evitar_fritos_preparados_si_busqueda_generica",
        acceptedCount: allowedFoods.length,
        rejected: rejected.slice(0, 8).map(food => ({ foodId: food?.food_id, name: food?.food_name })),
      });
    }
    return allowedFoods;
  }
  const exactFoods = foods.filter(food => isAllowedExactOliveOilName(food?.food_name ?? ""));
  attempts?.push({
    provider,
    query,
    exactRule: "solo_aceite_de_oliva_simple",
    acceptedNames: ["Olive Oil", "Aceite de oliva", "Extra Virgin Olive Oil"],
    acceptedCount: exactFoods.length,
    rejected: foods
      .filter(food => !isAllowedExactOliveOilName(food?.food_name ?? ""))
      .slice(0, 8)
      .map(food => ({ foodId: food?.food_id, name: food?.food_name })),
  });
  return exactFoods;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function scoreFood(food: any, query: string) {
  const normalizedFood = normalizeName(food?.food_name ?? "");
  const normalizedQuery = normalizeName(query);
  if (!normalizedFood || !normalizedQuery) return 0;
  if (isDisallowedDefaultProcessedMatch(food?.food_name ?? "", query)) return -999;
  if (normalizedFood === normalizedQuery) return 100;
  if (!isReliableFoodNameMatch(food?.food_name ?? "", query)) return -999;
  const foodTokens = new Set(normalizedFood.split(" "));
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const overlap = queryTokens.filter(token => foodTokens.has(token)).length;
  return overlap * 12 +
    (normalizedFood.includes(normalizedQuery) ? 25 : 0) +
    (normalizedQuery.includes(normalizedFood) ? 15 : 0) +
    processingScore(food?.food_name ?? "", query) +
    cookingStateScore(food?.food_name ?? "", query);
}

function pickBestFoodWithScore(foods: any[], query: string) {
  return foods
    .map(food => ({ food, score: scoreFood(food, query) }))
    .sort((a, b) => b.score - a.score)[0] ?? null;
}

function pickBestServing(servings: any[], amount: number) {
  const metricServings = servings.filter(serving => {
    const unit = safeLowerCase(serving?.metric_serving_unit, "pickBestServing.metricUnit");
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
  const foods = filterAllowedProviderFoods(asArray(searchPayload?.foods_search?.results?.food), query, undefined, "fatsecret-v3");
  if (!foods.length) return null;

  const best = pickBestFoodWithScore(foods, query);
  if (!best || best.score < 20) return null;
  const bestFood = best.food;
  const servings = asArray(bestFood?.servings?.serving);
  const serving = pickBestServing(servings, amount);
  const macros = serving ? servingToMacros(serving, amount) : null;
  if (!macros) return null;
  if (macroCompatibilityIssueForSimpleFood(name, macros, amount)) return null;
  if (isBadLowFatMilkMatch(query, bestFood.food_name ?? "", macros, amount)) return null;

  return {
    provider: "fatsecret",
    matchedAs: readableMatchedFoodLabel(bestFood.food_name ?? query, name),
    displayName: readableMatchedFoodLabel(bestFood.food_name ?? query, name),
    providerMatchedAs: bestFood.food_name ?? query,
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
  const foods = filterAllowedProviderFoods(asArray(searchPayload?.foods?.food), query, undefined, "fatsecret-legacy");
  if (!foods.length) return null;
  const best = pickBestFoodWithScore(foods, query);
  if (!best || best.score < 20) return null;
  const bestFood = best.food;

  const foodPayload = await fatSecretRequest("server.api", {
    method: "food.get",
    food_id: String(bestFood.food_id),
    format: "json",
  });
  const servings = asArray(foodPayload?.food?.servings?.serving);
  const serving = pickBestServing(servings, amount);
  const macros = serving ? servingToMacros(serving, amount) : null;
  if (!macros) return null;
  if (macroCompatibilityIssueForSimpleFood(name, macros, amount)) return null;
  if (isBadLowFatMilkMatch(query, foodPayload?.food?.food_name ?? bestFood.food_name ?? "", macros, amount)) return null;

  return {
    provider: "fatsecret",
    matchedAs: readableMatchedFoodLabel(foodPayload?.food?.food_name ?? bestFood.food_name ?? query, name),
    displayName: readableMatchedFoodLabel(foodPayload?.food?.food_name ?? bestFood.food_name ?? query, name),
    providerMatchedAs: foodPayload?.food?.food_name ?? bestFood.food_name ?? query,
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

async function searchFatSecretOAuth1(name: string, amount: number, attempts?: any[]) {
  const query = cleanSearchName(name);
  if (!query) return null;

  const searchPayload = await fatSecretOAuth1Request({
    method: "foods.search",
    search_expression: query,
    format: "json",
    max_results: "8",
  });
  const foods = filterAllowedProviderFoods(asArray(searchPayload?.foods?.food), query, attempts, "fatsecret-oauth1");
  attempts?.push({ provider: "fatsecret-oauth1", query, resultCount: foods.length, results: foods.slice(0, 5).map(food => ({ foodId: food?.food_id, name: food?.food_name, score: scoreFood(food, query) })) });
  if (!foods.length) return null;
  const best = pickBestFoodWithScore(foods, query);
  if (!best || best.score < 20) {
    attempts?.push({ provider: "fatsecret-oauth1", query, rejected: true, reason: "score_bajo", bestScore: best?.score ?? 0, bestName: best?.food?.food_name ?? null });
    return null;
  }
  const bestFood = best.food;

  const foodPayload = await fatSecretOAuth1Request({
    method: "food.get",
    food_id: String(bestFood.food_id),
    format: "json",
  });
  const servings = asArray(foodPayload?.food?.servings?.serving);
  const serving = pickBestServing(servings, amount);
  const macros = serving ? servingToMacros(serving, amount) : null;
  if (!macros) {
    attempts?.push({ provider: "fatsecret-oauth1", query, rejected: true, reason: "sin_serving_metrico", matchedAs: foodPayload?.food?.food_name ?? bestFood.food_name ?? query });
    return null;
  }
  const compatibilityIssue = macroCompatibilityIssueForSimpleFood(name, macros, amount);
  if (compatibilityIssue) {
    attempts?.push({
      provider: "fatsecret-oauth1",
      query,
      rejected: true,
      matchedAs: foodPayload?.food?.food_name ?? bestFood.food_name ?? query,
      ...compatibilityIssue,
    });
    return null;
  }
  if (isBadLowFatMilkMatch(query, foodPayload?.food?.food_name ?? bestFood.food_name ?? "", macros, amount)) {
    attempts?.push({ provider: "fatsecret-oauth1", query, rejected: true, reason: "coincidencia_leche_incorrecta", matchedAs: foodPayload?.food?.food_name ?? bestFood.food_name ?? query, macros: roundMacros(macros) });
    return null;
  }

  return {
    provider: "fatsecret",
    matchedAs: readableMatchedFoodLabel(foodPayload?.food?.food_name ?? bestFood.food_name ?? query, name),
    displayName: readableMatchedFoodLabel(foodPayload?.food?.food_name ?? bestFood.food_name ?? query, name),
    providerMatchedAs: foodPayload?.food?.food_name ?? bestFood.food_name ?? query,
    foodId: bestFood.food_id,
    serving,
    macros,
  };
}

async function calculateWithFatSecret(name: string, grams: number, attempts?: any[]) {
  if (!getFatSecretCredentials()) return null;
  const internalMatch = findFood(name);
  const exactOnly = requiresExactFatSecretMatch(name);
  const candidates = exactOnly
    ? ["aceite de oliva", "olive oil", "extra virgin olive oil"]
    : Array.from(new Set([
      localizedSearchCandidate(name),
      name,
      internalMatch?.key,
      ...(internalMatch?.food.aliases ?? []),
    ].filter(Boolean).map(String)));

  for (const candidate of candidates) {
    try {
      const result = await searchFatSecretOAuth1(candidate, grams, attempts);
      if (result) return result;
    } catch (err: any) {
      attempts?.push({ provider: "fatsecret-oauth1", query: cleanSearchName(candidate), error: err?.message || String(err) });
      // Si las credenciales son OAuth 2.0 en lugar de Consumer Key/Secret, probamos el flujo Bearer.
      break;
    }
  }

  if (exactOnly) {
    attempts?.push({
      provider: "fatsecret",
      query: name,
      rejected: true,
      reason: "sin_coincidencia_exacta_para_aceite_de_oliva",
      message: "No se usará ningún alimento compuesto ni coincidencia aproximada para aceite de oliva.",
    });
    return null;
  }

  try {
    const result = await searchFatSecretV3(candidates[0] ?? name, grams);
    attempts?.push({ provider: "fatsecret-v3", query: cleanSearchName(candidates[0] ?? name), used: Boolean(result) });
    return result;
  } catch (err: any) {
    attempts?.push({ provider: "fatsecret-v3", query: cleanSearchName(candidates[0] ?? name), error: err?.message || String(err) });
    try {
      const result = await searchFatSecretLegacy(candidates[0] ?? name, grams);
      attempts?.push({ provider: "fatsecret-legacy", query: cleanSearchName(candidates[0] ?? name), used: Boolean(result) });
      return result;
    } catch (legacyErr: any) {
      attempts?.push({ provider: "fatsecret-legacy", query: cleanSearchName(candidates[0] ?? name), error: legacyErr?.message || String(legacyErr) });
      return null;
    }
  }
}

async function verifySession(authHeader: string | undefined) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Debes iniciar sesión" };

  const supabase = createSupabaseForToken(token);
  if (!supabase) return { ok: false, status: 500, error: "Supabase no está configurado" };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: "Sesión no válida" };

  return { ok: true, status: 200, error: "", token };
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  let inputIngredients: IngredientInput[] = [];
  let servings = 1;

  try {
    const session = await verifySession(req.headers.authorization);
    if (!session.ok) return res.status(session.status).json({ error: session.error });
    const sessionToken = "token" in session ? session.token : "";

    const body = req.body ?? {};
    servings = Math.max(1, Math.round(Number(body.servings) || 1));
    inputIngredients = Array.isArray(body.ingredients)
      ? body.ingredients
      : String(body.ingredientsText || "")
        .split("\n")
        .map((line: string) => line.trim())
        .filter(Boolean)
        .map(parseRawIngredient);

    console.info("[macro-specialist] request", JSON.stringify({
      servings,
      category: body.category ?? "",
      ingredients: inputIngredients.map(item => ({
        raw: item.raw,
        parsedName: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        grams: item.grams ?? null,
      })),
    }));

  const externalApisConfigured = {
    products: false,
    unifiedFoods: false,
    internalFoods: false,
    fatSecret: Boolean(getFatSecretCredentials()),
    usda: Boolean(getUsdaApiKey()),
  };
  const loadAttempts: any[] = [];
  const products = sessionToken ? await loadProducts(sessionToken, loadAttempts) : [];
  const unifiedFoods = sessionToken ? await loadUnifiedFoods(sessionToken, loadAttempts) : [];
  const internalFoods = sessionToken ? await loadInternalFoods(sessionToken) : [];
  externalApisConfigured.products = products.length > 0;
  externalApisConfigured.unifiedFoods = unifiedFoods.length > 0;
  externalApisConfigured.internalFoods = internalFoods.length > 0;

  const totals = zeroMacros();
  const found: any[] = [];
  const notFound: any[] = [];
  const missingGrams: any[] = [];
  const fallbackUsed: any[] = [];
  const fatSecretErrors: any[] = [];
  const debug: IngredientDebugEntry[] = [];

  for (const ingredient of inputIngredients) {
    const name = String(ingredient.name || ingredient.raw || "").trim();
    const grams = Number(ingredient.grams);
    const debugEntry: IngredientDebugEntry = {
      raw: String(ingredient.raw ?? name),
      parsedName: name,
      quantity: ingredient.quantity == null ? null : Number(ingredient.quantity),
      unit: ingredient.unit,
      grams: Number.isFinite(grams) ? grams : null,
      status: "pendiente",
      attempts: [],
    };
    if (!name) continue;

    for (const attempt of loadAttempts) debugEntry.attempts?.push(attempt);
    const hasValidGrams = Number.isFinite(grams) && grams > 0;
    const tryProductMatch = () => {
      if (isBasicIngredientOnlyQuery(name) || isBasicIngredientOnlyQuery(ingredient.raw)) {
        debugEntry.attempts?.push({
          provider: "productos",
          used: false,
          reason: "ingrediente_basico_no_consulta_productos",
          skippedExternalApis: true,
        });
        return false;
      }
      const productMatch = findProduct(ingredient, products);
      if (!productMatch) return false;
      const productCalculation = calculateProductMacros(ingredient, productMatch, Number.isFinite(grams) ? grams : null);
      if (!productCalculation) {
        missingGrams.push({ name, raw: ingredient.raw ?? name, reason: "Producto encontrado, pero su ficha nutricional está pendiente o la medida no tiene gramos válidos" });
        debugEntry.status = "producto_pendiente";
        debugEntry.source = "productos";
        debugEntry.matchedAs = productMatch.name;
        debugEntry.foodId = productMatch.id;
        debugEntry.attempts?.push({
          provider: "productos",
          matchedAs: productMatch.name,
          used: false,
          reason: "ficha_nutricional_pendiente_o_medida_sin_gramos",
          source: productMatch.source,
          verificationStatus: productMatch.verification_status,
          skippedExternalApis: true,
        });
        debug.push(debugEntry);
        return true;
      }

      addMacros(totals, productCalculation.macros);
      debugEntry.status = "incluido";
      debugEntry.source = "productos";
      debugEntry.sourceLabel = sourceLabelForFoundItem("productos");
      debugEntry.matchedAs = productCalculation.matchedAs;
      debugEntry.foodId = productMatch.id;
      debugEntry.grams = productCalculation.grams;
      debugEntry.macros = roundMacros(productCalculation.macros);
      debugEntry.calorieCheck = calorieCheck(productCalculation.macros);
      debugEntry.attempts?.push({
        provider: "productos",
        used: true,
        matchedAs: productCalculation.matchedAs,
        measure: productCalculation.measureName,
        source: productMatch.source,
        verificationStatus: productMatch.verification_status,
        skippedExternalApis: true,
        macros: roundMacros(productCalculation.macros),
      });
      found.push({
        name,
        matchedAs: productCalculation.matchedAs,
        grams: productCalculation.grams,
        source: "productos",
        sourceLabel: sourceLabelForFoundItem("productos"),
        foodId: productMatch.id,
        measure: productCalculation.measureName,
        macros: roundMacros(productCalculation.macros),
      });
      debug.push(debugEntry);
      return true;
    };

    if (!hasValidGrams && tryProductMatch()) {
      continue;
    }

    if (!hasValidGrams) {
      missingGrams.push({ name, raw: ingredient.raw ?? name });
      debugEntry.status = "sin_gramos";
      debug.push(debugEntry);
      continue;
    }

    const internalExactMatch = findInternalFoodByMode(name, internalFoods, "exact");
    if (internalExactMatch) {
      const itemMacros = scaleInternalFood(internalExactMatch.row, grams);
      addMacros(totals, itemMacros);
      debugEntry.status = "incluido";
      debugEntry.source = "alimentos_internos";
      debugEntry.sourceLabel = sourceLabelForFoundItem("alimentos_internos");
      debugEntry.matchedAs = internalExactMatch.row.name;
      debugEntry.foodId = internalExactMatch.row.id;
      debugEntry.macros = roundMacros(itemMacros);
      debugEntry.rawNutrition = internalFoodNutrition(internalExactMatch.row);
      debugEntry.calorieCheck = calorieCheck(itemMacros);
      debugEntry.attempts?.push({
        provider: "alimentos_internos",
        used: true,
        matchedAs: internalExactMatch.row.name,
        matchedBy: internalExactMatch.key,
        matchMode: "exact",
        baseQuantity: internalExactMatch.row.base_quantity,
        baseUnit: internalExactMatch.row.base_unit,
        source: internalExactMatch.row.source,
        rawNutrition: internalFoodNutrition(internalExactMatch.row),
        skippedExternalApis: true,
        macros: roundMacros(itemMacros),
      });
      found.push({
        name,
        matchedAs: internalExactMatch.row.name,
        grams,
        source: "alimentos_internos",
        sourceLabel: sourceLabelForFoundItem("alimentos_internos"),
        foodId: internalExactMatch.row.id,
        macros: roundMacros(itemMacros),
      });
      debug.push(debugEntry);
      continue;
    }

    const manualUnifiedExactMatch = findUnifiedFoodByMode(name, unifiedFoods, ["manual"], "exact");
    if (manualUnifiedExactMatch) {
      const itemMacros = scaleUnifiedFood(manualUnifiedExactMatch.row, grams);
      addMacros(totals, itemMacros);
      debugEntry.status = "incluido";
      debugEntry.source = "base_interna";
      debugEntry.sourceLabel = sourceLabelForFoundItem("alimentos_unificados", manualUnifiedExactMatch.row.source_type);
      debugEntry.matchedAs = manualUnifiedExactMatch.row.nombre;
      debugEntry.foodId = manualUnifiedExactMatch.row.id;
      debugEntry.macros = roundMacros(itemMacros);
      debugEntry.calorieCheck = calorieCheck(itemMacros);
      debugEntry.attempts?.push({
        provider: "food_items_manual",
        used: true,
        matchedAs: manualUnifiedExactMatch.row.nombre,
        matchedBy: manualUnifiedExactMatch.key,
        matchMode: "exact",
        category: manualUnifiedExactMatch.row.categoria,
        state: manualUnifiedExactMatch.row.estado,
        sourceType: manualUnifiedExactMatch.row.source_type,
        source: manualUnifiedExactMatch.row.fuente,
        verified: manualUnifiedExactMatch.row.verificado,
        skippedExternalApis: true,
        macros: roundMacros(itemMacros),
      });
      found.push({
        name,
        matchedAs: manualUnifiedExactMatch.row.nombre,
        displayName: manualUnifiedExactMatch.row.nombre,
        grams,
        source: "alimentos_unificados",
        sourceType: manualUnifiedExactMatch.row.source_type,
        sourceLabel: sourceLabelForFoundItem("alimentos_unificados", manualUnifiedExactMatch.row.source_type),
        foodId: manualUnifiedExactMatch.row.id,
        macros: roundMacros(itemMacros),
      });
      debug.push(debugEntry);
      continue;
    }

    const internalMatch = findInternalFoodByMode(name, internalFoods, "partial");
    if (internalMatch) {
      const itemMacros = scaleInternalFood(internalMatch.row, grams);
      addMacros(totals, itemMacros);
      fallbackUsed.push({ name, matchedAs: internalMatch.row.name, source: "alimentos_internos" });
      debugEntry.status = "incluido";
      debugEntry.source = "alimentos_internos";
      debugEntry.sourceLabel = sourceLabelForFoundItem("alimentos_internos");
      debugEntry.matchedAs = internalMatch.row.name;
      debugEntry.foodId = internalMatch.row.id;
      debugEntry.macros = roundMacros(itemMacros);
      debugEntry.rawNutrition = internalFoodNutrition(internalMatch.row);
      debugEntry.calorieCheck = calorieCheck(itemMacros);
      debugEntry.attempts?.push({
        provider: "alimentos_internos",
        used: true,
        matchedAs: internalMatch.row.name,
        matchedBy: internalMatch.key,
        matchMode: "partial",
        baseQuantity: internalMatch.row.base_quantity,
        baseUnit: internalMatch.row.base_unit,
        source: internalMatch.row.source,
        rawNutrition: internalFoodNutrition(internalMatch.row),
        skippedExternalApis: true,
        macros: roundMacros(itemMacros),
      });
      found.push({
        name,
        matchedAs: internalMatch.row.name,
        grams,
        source: "alimentos_internos",
        sourceLabel: sourceLabelForFoundItem("alimentos_internos"),
        foodId: internalMatch.row.id,
        macros: roundMacros(itemMacros),
      });
      debug.push(debugEntry);
      continue;
    }

    const manualUnifiedMatch = findUnifiedFoodByMode(name, unifiedFoods, ["manual"], "partial");
    if (manualUnifiedMatch) {
      const itemMacros = scaleUnifiedFood(manualUnifiedMatch.row, grams);
      addMacros(totals, itemMacros);
      debugEntry.status = "incluido";
      debugEntry.source = "base_interna";
      debugEntry.sourceLabel = sourceLabelForFoundItem("alimentos_unificados", manualUnifiedMatch.row.source_type);
      debugEntry.matchedAs = manualUnifiedMatch.row.nombre;
      debugEntry.foodId = manualUnifiedMatch.row.id;
      debugEntry.macros = roundMacros(itemMacros);
      debugEntry.calorieCheck = calorieCheck(itemMacros);
      debugEntry.attempts?.push({
        provider: "food_items_manual",
        used: true,
        matchedAs: manualUnifiedMatch.row.nombre,
        matchedBy: manualUnifiedMatch.key,
        matchMode: "partial",
        category: manualUnifiedMatch.row.categoria,
        state: manualUnifiedMatch.row.estado,
        sourceType: manualUnifiedMatch.row.source_type,
        source: manualUnifiedMatch.row.fuente,
        verified: manualUnifiedMatch.row.verificado,
        skippedExternalApis: true,
        macros: roundMacros(itemMacros),
      });
      found.push({
        name,
        matchedAs: manualUnifiedMatch.row.nombre,
        displayName: manualUnifiedMatch.row.nombre,
        grams,
        source: "alimentos_unificados",
        sourceType: manualUnifiedMatch.row.source_type,
        sourceLabel: sourceLabelForFoundItem("alimentos_unificados", manualUnifiedMatch.row.source_type),
        foodId: manualUnifiedMatch.row.id,
        macros: roundMacros(itemMacros),
      });
      debug.push(debugEntry);
      continue;
    }

    if (tryProductMatch()) {
      continue;
    }

    debugEntry.attempts?.push({
      provider: "base_interna",
      used: false,
      reason: externalApisConfigured.internalFoods || externalApisConfigured.unifiedFoods ? "sin_coincidencia_interna_manual" : "base_interna_no_disponible_o_vacia",
      fallback: "alimentos_unificados_externos",
    });

    const unifiedMatch = findUnifiedFood(name, unifiedFoods, ["bedca", "usda", "open_food_facts"]);
    if (unifiedMatch) {
      const itemMacros = scaleUnifiedFood(unifiedMatch.row, grams);
      addMacros(totals, itemMacros);
      debugEntry.status = "incluido";
      debugEntry.source = "alimentos_unificados";
      debugEntry.sourceLabel = sourceLabelForFoundItem("alimentos_unificados", unifiedMatch.row.source_type);
      debugEntry.matchedAs = unifiedMatch.row.nombre;
      debugEntry.foodId = unifiedMatch.row.id;
      debugEntry.macros = roundMacros(itemMacros);
      debugEntry.calorieCheck = calorieCheck(itemMacros);
      debugEntry.attempts?.push({
        provider: "alimentos_unificados",
        used: true,
        matchedAs: unifiedMatch.row.nombre,
        matchedBy: unifiedMatch.key,
        category: unifiedMatch.row.categoria,
        state: unifiedMatch.row.estado,
        sourceType: unifiedMatch.row.source_type,
        source: unifiedMatch.row.fuente,
        verified: unifiedMatch.row.verificado,
        skippedExternalApis: true,
        macros: roundMacros(itemMacros),
      });
      found.push({
        name,
        matchedAs: unifiedMatch.row.nombre,
        displayName: unifiedMatch.row.nombre,
        grams,
        source: "alimentos_unificados",
        sourceType: unifiedMatch.row.source_type,
        sourceLabel: sourceLabelForFoundItem("alimentos_unificados", unifiedMatch.row.source_type),
        foodId: unifiedMatch.row.id,
        macros: roundMacros(itemMacros),
      });
      debug.push(debugEntry);
      continue;
    }

    debugEntry.attempts?.push({
      provider: "alimentos_unificados",
      used: false,
      reason: externalApisConfigured.unifiedFoods ? "sin_coincidencia_verificada" : "tabla_no_disponible_o_vacia",
      fallback: externalApisConfigured.usda ? "usda" : externalApisConfigured.fatSecret ? "fatsecret" : "alimentos_internos",
    });

    const usdaMatch = externalApisConfigured.usda ? await searchUsdaFood(name, grams, debugEntry.attempts) : null;
    if (!externalApisConfigured.usda) {
      debugEntry.attempts?.push({
        provider: "usda",
        skipped: true,
        reason: "USDA_API_KEY_no_configurada",
        fallback: externalApisConfigured.fatSecret ? "fatsecret" : "alimentos_internos",
      });
    }

    const providerMatch = usdaMatch ?? await calculateWithFatSecret(name, grams, debugEntry.attempts);
    if (providerMatch?.macros) {
      addMacros(totals, providerMatch.macros);
      debugEntry.status = "incluido";
      debugEntry.source = providerMatch.provider ?? "fatsecret";
      debugEntry.sourceLabel = sourceLabelForFoundItem(providerMatch.provider ?? "fatsecret");
      debugEntry.matchedAs = providerMatch.displayName ?? providerMatch.matchedAs;
      debugEntry.providerMatchedAs = providerMatch.providerMatchedAs;
      debugEntry.foodId = providerMatch.foodId;
      debugEntry.macros = roundMacros(providerMatch.macros);
      debugEntry.calorieCheck = calorieCheck(providerMatch.macros);
      found.push({
        name,
        matchedAs: providerMatch.displayName ?? providerMatch.matchedAs,
        displayName: providerMatch.displayName ?? providerMatch.matchedAs,
        providerMatchedAs: providerMatch.providerMatchedAs,
        grams,
        source: providerMatch.provider ?? "fatsecret",
        sourceLabel: sourceLabelForFoundItem(providerMatch.provider ?? "fatsecret"),
        foodId: providerMatch.foodId,
        macros: roundMacros(providerMatch.macros),
      });
      debug.push(debugEntry);
      continue;
    }

    if (externalApisConfigured.fatSecret && requiresExactFatSecretMatch(name)) {
      notFound.push({ name, grams, raw: ingredient.raw ?? name, reason: "Sin coincidencia exacta simple en FatSecret" });
      fatSecretErrors.push(name);
      debugEntry.status = "no_encontrado";
      debugEntry.source = "fatsecret";
      debugEntry.matchedAs = "Sin coincidencia exacta simple";
      debug.push(debugEntry);
      continue;
    }

    const match = findFood(name);
    if (!match) {
      notFound.push({ name, grams, raw: ingredient.raw ?? name });
      if (externalApisConfigured.fatSecret) fatSecretErrors.push(name);
      debugEntry.status = "no_encontrado";
      debug.push(debugEntry);
      continue;
    }

    const itemMacros = scale(match.food, grams);
    addMacros(totals, itemMacros);
    fallbackUsed.push({ name, matchedAs: match.key, source: "tabla_interna_basica" });
    debugEntry.status = "incluido";
    debugEntry.source = "tabla_interna";
    debugEntry.sourceLabel = sourceLabelForFoundItem("tabla_interna");
    debugEntry.matchedAs = match.key;
    debugEntry.macros = roundMacros(itemMacros);
    debugEntry.calorieCheck = calorieCheck(itemMacros);
    found.push({
      name,
      matchedAs: match.key,
      grams,
      source: "tabla_interna",
      sourceLabel: sourceLabelForFoundItem("tabla_interna"),
      macros: roundMacros(itemMacros),
    });
    debug.push(debugEntry);
  }

  const externalSourceUsed = found.some(item =>
    item.source === "productos" ||
    item.source === "alimentos_unificados" ||
    item.source === "usda" ||
    item.source === "fatsecret",
  );
  const sourcesUsed = Array.from(new Set(found.map(item => item.source).filter(Boolean)));
  const status: MacroStatus =
    notFound.length || missingGrams.length
      ? "pendiente de revisión"
      : fallbackUsed.length || !externalSourceUsed
        ? "estimado"
        : "verificado";

  const strictTotals = enforceMacroCalories(totals);
  const totalRounded = roundMacros(strictTotals);
  const perServing = roundMacros(divideMacros(strictTotals, servings));

  const responseBody = {
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
    debug,
    warnings: {
      notFound: notFound.map(i => i.name),
      missingGrams: missingGrams.map(i => i.name),
      fallbackUsed,
      fatSecretUnavailableFor: fatSecretErrors,
      externalApisConfigured,
      dataSource: externalSourceUsed
        ? fallbackUsed.length || notFound.length || missingGrams.length
          ? `${sourcesUsed.join("_")}_con_respaldo_tabla_interna`
          : sourcesUsed.join("_")
        : "tabla_interna_basica_por_100g",
    },
    envPrepared: ["PRODUCTOS_PROPIOS", "ALIMENTOS_ESPANOLES_VERIFICADOS", "FATSECRET_CONSUMER_KEY", "FATSECRET_CONSUMER_SECRET", "USDA_API_KEY"],
  };

  console.info("[macro-specialist] calculation", JSON.stringify({
    servings,
    ingredients: debug.map(item => ({
      raw: item.raw,
      parsedName: item.parsedName,
      quantity: item.quantity,
      unit: item.unit,
      grams: item.grams,
      status: item.status,
      source: item.source,
      sourceLabel: item.sourceLabel,
      matchedAs: item.matchedAs,
      foodId: item.foodId,
      rawNutrition: item.rawNutrition,
      macros: item.macros,
      calorieCheck: item.calorieCheck,
      attempts: item.attempts,
    })),
    perServing,
    totals: totalRounded,
    status,
  }));

  return res.status(200).json(responseBody);
  } catch (err: any) {
    const message = err?.message || String(err);
    const failedIngredients = inputIngredients
      .filter(item => !item.name || !Number.isFinite(Number(item.grams)) || Number(item.grams) <= 0)
      .map(item => String(item.raw || item.name || "Ingrediente sin nombre"));

    console.error("[macro-specialist] fatal error", JSON.stringify({
      error: message,
      stack: err?.stack,
      servings,
      ingredients: inputIngredients.map(item => ({
        raw: item.raw,
        parsedName: item.name,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        grams: item.grams ?? null,
      })),
      failedIngredients,
    }));

    return res.status(500).json({
      error: "Error interno calculando macros",
      detail: message,
      stack: err?.stack ?? null,
      failedIngredient: failedIngredients[0] ?? null,
      failedIngredients,
    });
  }
}
