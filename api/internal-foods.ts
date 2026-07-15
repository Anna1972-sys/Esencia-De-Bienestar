import { createClient } from "@supabase/supabase-js";

function pickSupabaseUrl(...candidates: Array<string | undefined>) {
  return candidates.map(cleanEnvValue).find((url): url is string => /^https:\/\//.test(url ?? "")) ?? "";
}

function cleanEnvValue(value: string | undefined) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const envAssignment = cleaned.match(/^[A-Z0-9_]+\s*=\s*(.+)$/i);
  const unwrapped = (envAssignment?.[1] ?? cleaned)
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const embeddedKey = unwrapped.match(/sb_secret_[A-Za-z0-9_-]+|sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
  return embeddedKey ?? unwrapped;
}

function getSupabaseConfig() {
  const supabaseUrl = pickSupabaseUrl(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_URL);
  const supabaseAnonKey = cleanEnvValue(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  );
  const supabaseServiceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } : null;
}

async function readBody(req: any) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function nullableNumber(value: any) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePayload(input: any) {
  return {
    name: String(input?.name ?? "").trim(),
    synonyms: Array.isArray(input?.synonyms)
      ? input.synonyms.map((item: any) => String(item).trim()).filter(Boolean)
      : [],
    base_quantity: Number(input?.base_quantity) || 100,
    base_unit: ["g", "ml", "serving"].includes(input?.base_unit) ? input.base_unit : "g",
    calories: Number(input?.calories) || 0,
    protein: Number(input?.protein) || 0,
    carbs: Number(input?.carbs) || 0,
    fat: Number(input?.fat) || 0,
    fiber: Number(input?.fiber) || 0,
    salt: Number(input?.salt) || 0,
    azucares_g: nullableNumber(input?.azucares_g ?? input?.azucares_9),
    grasas_saturadas_g: nullableNumber(input?.grasas_saturadas_g),
    category: String(input?.category ?? "general").trim() || "general",
    source: String(input?.source ?? "Tabla interna").trim() || "Tabla interna",
    is_active: Boolean(input?.is_active ?? true),
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req: any, res: any) {
  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  console.info("[internal-foods auth diagnostic] api request", {
    method: req.method,
    hasAuthorizationHeader: Boolean(authHeader),
    hasBearerPrefix: /^Bearer\s+/i.test(authHeader),
    tokenPresent: Boolean(token),
  });
  if (!token) return res.status(401).json({ error: "Sesión requerida" });

  const config = getSupabaseConfig();
  if (!config) {
    console.warn("[internal-foods auth diagnostic] api config missing");
    return res.status(500).json({
      error: "Supabase no está configurado en la API de Alimentos internos.",
    });
  }

  const authClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  console.info("[internal-foods auth diagnostic] api supabase validation", {
    validSession: Boolean(userData?.user),
    rejectedBySupabase: Boolean(userError),
    errorMessage: userError?.message ?? null,
    errorStatus: (userError as any)?.status ?? null,
  });
  if (userError || !userData?.user) return res.status(401).json({ error: "Sesión no válida" });

  if (req.method === "GET") {
    const readFoods = (select: string) => (authClient as any)
      .schema("public")
      .from("internal_foods")
      .select(select)
      .order("name", { ascending: true });

    let { data, error } = await readFoods(INTERNAL_FOOD_SELECT);

    if (error && isMissingOptionalInternalFoodColumn(error)) {
      const withoutNewFields = await readFoods(INTERNAL_FOOD_SELECT_WITH_SALT);
      data = (withoutNewFields.data ?? []).map(withDefaultOptionalNutrition);
      error = withoutNewFields.error;
    }

    if (error && isMissingSaltColumn(error)) {
      const legacy = await readFoods(INTERNAL_FOOD_SELECT_LEGACY);
      data = (legacy.data ?? []).map(withDefaultOptionalNutrition);
      error = legacy.error;
    }

    if (error) {
      console.warn("[internal-foods] Supabase read failed", {
        code: error.code,
        message: error.message,
        supabaseHost: safeSupabaseHost(config.supabaseUrl),
      });
      return res.status(500).json({
        error: error.message,
        code: error.code,
        supabaseHost: safeSupabaseHost(config.supabaseUrl),
      });
    }

    return res.status(200).json({ data: data ?? [], source: "supabase" });
  }

  if (req.method === "POST") {
    const payload = normalizePayload(await readBody(req));
    if (!payload.name) return res.status(400).json({ error: "El nombre del alimento es obligatorio" });

    const { data, error } = await writeInternalFood({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
      anonKey: config.supabaseAnonKey,
      userToken: token,
      method: "POST",
      payload,
    });

    if (error) return res.status(400).json(normalizeSupabaseWriteError(error));
    if (!data) return res.status(404).json({ error: "No se ha encontrado el alimento real en Supabase. Recarga la pantalla e inténtalo de nuevo." });
    return res.status(200).json({ data });
  }

  if (req.method === "PUT") {
    const body = await readBody(req);
    const id = String(body?.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "Falta el ID del alimento" });
    const payload = normalizePayload(body);
    if (!payload.name) return res.status(400).json({ error: "El nombre del alimento es obligatorio" });

    const { data, error } = await writeInternalFood({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
      anonKey: config.supabaseAnonKey,
      userToken: token,
      method: "PATCH",
      id,
      payload,
    });

    if (error) return res.status(400).json(normalizeSupabaseWriteError(error));
    return res.status(200).json({ data });
  }

  const body = await readBody(req);
  const id = String(body?.id ?? req.query?.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "Falta el ID del alimento" });

  const { error } = await writeInternalFood({
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
    anonKey: config.supabaseAnonKey,
    userToken: token,
    method: "DELETE",
    id,
  });

  if (error) return res.status(400).json(normalizeSupabaseWriteError(error));
  return res.status(200).json({ ok: true });
}

const INTERNAL_FOOD_SELECT = "id,name,synonyms,base_quantity,base_unit,calories,protein,carbs,fat,fiber,salt,azucares_g,grasas_saturadas_g,category,source,is_active";
const INTERNAL_FOOD_SELECT_WITH_SALT = "id,name,synonyms,base_quantity,base_unit,calories,protein,carbs,fat,fiber,salt,category,source,is_active";
const INTERNAL_FOOD_SELECT_LEGACY = "id,name,synonyms,base_quantity,base_unit,calories,protein,carbs,fat,fiber,category,source,is_active";
const NEW_INTERNAL_FOOD_COLUMNS = ["azucares_g", "azucares_9", "grasas_saturadas_g"];

async function writeInternalFood({
  supabaseUrl,
  serviceRoleKey,
  anonKey,
  userToken,
  method,
  id,
  payload,
}: {
  supabaseUrl: string;
  serviceRoleKey: string;
  anonKey: string;
  userToken: string;
  method: "POST" | "PATCH" | "DELETE";
  id?: string;
  payload?: Record<string, any>;
}) {
  const attempts = buildWriteAuthAttempts({ serviceRoleKey, anonKey, userToken });
  let lastError: any = null;
  let omitNewNutritionFields = false;
  let omitSaltAndNewNutritionFields = false;

  for (let optionalNutritionRetry = 0; optionalNutritionRetry < 2; optionalNutritionRetry += 1) {
    const filter = id ? `&id=eq.${encodeURIComponent(id)}` : "";
    const selectColumns = omitSaltAndNewNutritionFields
      ? INTERNAL_FOOD_SELECT_LEGACY
      : omitNewNutritionFields
        ? INTERNAL_FOOD_SELECT_WITH_SALT
        : INTERNAL_FOOD_SELECT;
    const select = method === "DELETE" ? "" : `?select=${selectColumns}${filter}`;
    const deleteFilter = method === "DELETE" ? `?id=eq.${encodeURIComponent(id ?? "")}` : "";
    const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/internal_foods${select || deleteFilter}`;
    const bodyPayload = omitSaltAndNewNutritionFields && payload
      ? omitSaltAndNewNutrition(payload)
      : omitNewNutritionFields && payload
        ? omitNewNutrition(payload)
        : payload;

    for (const attempt of attempts) {
      const response = await fetch(url, {
        method,
        headers: {
          apikey: attempt.apikey,
          Authorization: `Bearer ${attempt.authorization}`,
          ...(bodyPayload ? { "Content-Type": "application/json" } : {}),
          Prefer: method === "DELETE" ? "return=minimal" : "return=representation",
        },
        ...(bodyPayload ? { body: JSON.stringify(bodyPayload) } : {}),
      });

      if (response.ok) {
        if (method === "DELETE") return { data: null, error: null };
        const rows = await response.json().catch(() => []);
        const row = Array.isArray(rows) ? rows[0] : rows;
        return { data: withDefaultOptionalNutrition(row), error: null };
      }

      const errorPayload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) }));
      lastError = {
        message: errorPayload?.message || errorPayload?.error || response.statusText,
        code: errorPayload?.code || String(response.status),
        details: errorPayload?.details,
      };

      if (isMissingOptionalInternalFoodColumn(lastError) && !omitNewNutritionFields) {
        omitNewNutritionFields = true;
        break;
      }

      if (isMissingSaltColumn(lastError) && !omitSaltAndNewNutritionFields) {
        omitSaltAndNewNutritionFields = true;
        break;
      }

      if (!/invalid api key|wrong key type|no suitable key/i.test(String(lastError.message))) break;
    }

    if (
      (!omitNewNutritionFields || !isMissingOptionalInternalFoodColumn(lastError)) &&
      (!omitSaltAndNewNutritionFields || !isMissingSaltColumn(lastError))
    ) break;
  }

  return { data: null, error: lastError ?? { message: "Error al guardar el alimento interno" } };
}

function buildWriteAuthAttempts({
  serviceRoleKey,
  anonKey,
  userToken,
}: {
  serviceRoleKey: string;
  anonKey: string;
  userToken: string;
}) {
  const candidates = serviceRoleKey
    ? [
        { apikey: serviceRoleKey, authorization: serviceRoleKey },
        { apikey: anonKey, authorization: userToken },
      ]
    : [
        { apikey: anonKey, authorization: userToken },
      ];

  const seen = new Set<string>();
  return candidates.filter(item => {
    const key = `${item.apikey}|${item.authorization}`;
    if (!item.apikey || !item.authorization || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function safeSupabaseHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function isMissingOptionalInternalFoodColumn(error: any) {
  const message = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`;
  return NEW_INTERNAL_FOOD_COLUMNS.some(column => message.includes(column)) &&
    /column|schema|cache|find|exist/i.test(message);
}

function isMissingSaltColumn(error: any) {
  const message = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`;
  return /salt/i.test(message) && /column|schema|cache|find|exist/i.test(message);
}

function withDefaultOptionalNutrition(row: any) {
  if (!row || typeof row !== "object") return row;
  return {
    ...row,
    salt: Number(row.salt ?? 0),
    azucares_g: row.azucares_g ?? row.azucares_9 ?? null,
    grasas_saturadas_g: row.grasas_saturadas_g ?? null,
  };
}

function omitNewNutrition(payload: Record<string, any>) {
  const { azucares_g, azucares_9, grasas_saturadas_g, ...rest } = payload;
  return rest;
}

function omitSaltAndNewNutrition(payload: Record<string, any>) {
  const { salt, azucares_g, azucares_9, grasas_saturadas_g, ...rest } = payload;
  return rest;
}

function normalizeSupabaseWriteError(error: any) {
  const message = String(error?.message ?? "Error al guardar el alimento interno");
  if (/invalid api key/i.test(message)) {
    return {
      error: "Supabase ha rechazado las credenciales de backend para guardar alimentos internos.",
      code: error?.code,
    };
  }
  return { error: message, code: error?.code };
}
