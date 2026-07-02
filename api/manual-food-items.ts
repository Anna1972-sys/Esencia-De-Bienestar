import { createClient } from "@supabase/supabase-js";

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

function pickSupabaseUrl(...candidates: Array<string | undefined>) {
  return candidates.map(cleanEnvValue).find((url): url is string => /^https:\/\//.test(url ?? "")) ?? "";
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

function normalizeName(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberOrNull(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function textArray(value: unknown) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value ?? "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizePayload(input: any) {
  const nombre = String(input?.nombre ?? "").trim();
  const estado = ["crudo", "cocido", "natural", "procesado"].includes(input?.estado) ? input.estado : "natural";
  return {
    source_type: "manual",
    source_id: "",
    nombre,
    nombre_normalizado: normalizeName(nombre),
    aliases: textArray(input?.aliases),
    categoria: String(input?.categoria ?? "general").trim() || "general",
    estado,
    kcal_100g: numberOrNull(input?.kcal_100g),
    proteina_100g: numberOrNull(input?.proteina_100g),
    hidratos_100g: numberOrNull(input?.hidratos_100g),
    grasa_100g: numberOrNull(input?.grasa_100g),
    fibra_100g: numberOrNull(input?.fibra_100g),
    azucares_100g: numberOrNull(input?.azucares_100g),
    sal_100g: numberOrNull(input?.sal_100g),
    fuente: "Alimento manual",
    verificado: true,
    is_active: Boolean(input?.is_active ?? true),
    raw_data: {
      created_from: "admin_macro_specialist",
      manual: true,
    },
    updated_at: new Date().toISOString(),
  };
}

function logManualFoodStep(step: string, data: Record<string, any>) {
  const safeData = JSON.parse(JSON.stringify(data, (_key, value) => {
    if (typeof value === "string" && value.length > 700) return `${value.slice(0, 700)}…`;
    return value;
  }));
  console.info(`[manual-food-items] ${step}`, safeData);
}

function validatePayload(payload: Record<string, any>) {
  const errors: string[] = [];
  const requiredTextFields = ["source_type", "nombre", "nombre_normalizado", "categoria", "estado", "fuente"];
  for (const field of requiredTextFields) {
    if (payload[field] === undefined || payload[field] === null || String(payload[field]).trim() === "") {
      errors.push(`Falta el campo obligatorio ${field}`);
    }
  }
  if (payload.source_id === undefined || payload.source_id === null) {
    errors.push("Falta el campo obligatorio source_id");
  }
  if (!Array.isArray(payload.aliases)) errors.push("El campo aliases debe ser una lista");
  if (!payload.raw_data || typeof payload.raw_data !== "object") errors.push("El campo raw_data debe ser un objeto");
  if (typeof payload.verificado !== "boolean") errors.push("El campo verificado debe ser booleano");
  if (typeof payload.is_active !== "boolean") errors.push("El campo is_active debe ser booleano");
  if (!["crudo", "cocido", "natural", "procesado"].includes(String(payload.estado ?? ""))) {
    errors.push("El campo estado debe ser crudo, cocido, natural o procesado");
  }
  for (const field of ["kcal_100g", "proteina_100g", "hidratos_100g", "grasa_100g", "fibra_100g", "azucares_100g", "sal_100g"]) {
    const value = payload[field];
    if (value !== null && value !== undefined && !Number.isFinite(Number(value))) {
      errors.push(`El campo ${field} debe ser numérico o estar vacío`);
    }
  }
  return errors;
}

function normalizeWriteError(error: any) {
  const message = String(error?.message ?? "Error al guardar el alimento manual");
  const details = String(error?.details ?? "");
  const hint = String(error?.hint ?? "");
  if (error?.code === "23505" || /duplicate key|unique/i.test(`${message} ${details}`)) {
    return {
      error: "Ya existe un alimento manual con ese nombre normalizado.",
      detail: details || message,
      code: "manual_food_duplicate",
      hint,
    };
  }
  if (/row-level security|violates row-level security|permission denied/i.test(`${message} ${details}`)) {
    return {
      error: "Supabase no permite guardar este alimento manual con la sesión actual. Revisa que esté aplicada la política RLS de alimentos manuales para administradoras.",
      detail: details || message,
      code: error?.code,
      hint,
    };
  }
  return {
    error: message,
    detail: details,
    code: error?.code,
    hint,
  };
}

async function verifyAdmin(supabaseUrl: string, supabaseAnonKey: string, token: string) {
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) return { ok: false, status: 401, error: "Sesión no válida" };

  const { data: isAdmin, error: roleError } = await (authClient as any).rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleError || !isAdmin) return { ok: false, status: 403, error: "Solo la administradora puede gestionar alimentos manuales" };

  return { ok: true, status: 200, error: "" };
}

const FOOD_ITEM_SELECT = [
  "id",
  "nombre",
  "nombre_normalizado",
  "aliases",
  "categoria",
  "estado",
  "kcal_100g",
  "proteina_100g",
  "hidratos_100g",
  "grasa_100g",
  "fibra_100g",
  "azucares_100g",
  "sal_100g",
  "fuente",
  "verificado",
  "is_active",
].join(",");

function buildWriteAuthAttempts({
  serviceRoleKey,
  anonKey,
  userToken,
}: {
  serviceRoleKey?: string;
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

function buildReadHeaders({
  serviceRoleKey,
  anonKey,
  userToken,
}: {
  serviceRoleKey?: string;
  anonKey: string;
  userToken: string;
}) {
  if (serviceRoleKey) {
    return {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };
  }
  return {
    apikey: anonKey,
    Authorization: `Bearer ${userToken}`,
  };
}

async function findManualDuplicate({
  supabaseUrl,
  serviceRoleKey,
  anonKey,
  userToken,
  normalizedName,
  excludeId,
}: {
  supabaseUrl: string;
  serviceRoleKey?: string;
  anonKey: string;
  userToken: string;
  normalizedName: string;
  excludeId?: string;
}) {
  const idFilter = excludeId ? `&id=neq.${encodeURIComponent(excludeId)}` : "";
  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/food_items?select=id,nombre&source_type=eq.manual&nombre_normalizado=eq.${encodeURIComponent(normalizedName)}&limit=1${idFilter}`,
    {
      headers: buildReadHeaders({ serviceRoleKey, anonKey, userToken }),
    },
  );
  if (!response.ok) {
    const errorPayload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) }));
    logManualFoodStep("duplicate_check_error", {
      status: response.status,
      code: errorPayload?.code,
      message: errorPayload?.message || errorPayload?.error || response.statusText,
      details: errorPayload?.details,
      hint: errorPayload?.hint,
      normalizedName,
      excludeId,
    });
    return { duplicate: null, error: errorPayload };
  }
  const rows = await response.json().catch(() => []);
  logManualFoodStep("duplicate_check_response", {
    normalizedName,
    excludeId,
    duplicate: Array.isArray(rows) ? rows[0] ?? null : null,
  });
  return { duplicate: Array.isArray(rows) ? rows[0] : null, error: null };
}

async function writeFoodItem({
  supabaseUrl,
  serviceRoleKey,
  anonKey,
  userToken,
  method,
  id,
  payload,
}: {
  supabaseUrl: string;
  serviceRoleKey?: string;
  anonKey: string;
  userToken: string;
  method: "POST" | "PATCH";
  id?: string;
  payload: Record<string, any>;
}) {
  const filter = id ? `&id=eq.${encodeURIComponent(id)}` : "";
  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/food_items?select=${FOOD_ITEM_SELECT}${filter}`;
  const attempts = buildWriteAuthAttempts({ serviceRoleKey, anonKey, userToken });
  let lastError: any = null;

  for (const [index, attempt] of attempts.entries()) {
    logManualFoodStep("supabase_write_request", {
      method,
      id,
      attempt: index + 1,
      authMode: attempt.apikey === serviceRoleKey ? "service_role" : "authenticated_user",
      url,
      payload,
    });
    const response = await fetch(url, {
      method,
      headers: {
        apikey: attempt.apikey,
        Authorization: `Bearer ${attempt.authorization}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const rows = await response.json().catch(() => []);
      logManualFoodStep("supabase_write_success", {
        method,
        id,
        status: response.status,
        response: rows,
      });
      return { data: Array.isArray(rows) ? rows[0] : rows, error: null };
    }

    const errorPayload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) }));
    logManualFoodStep("supabase_write_error", {
      method,
      id,
      status: response.status,
      code: errorPayload?.code,
      message: errorPayload?.message || errorPayload?.error || response.statusText,
      details: errorPayload?.details,
      hint: errorPayload?.hint,
      payload,
    });
    lastError = {
      message: errorPayload?.message || errorPayload?.error || response.statusText,
      code: errorPayload?.code || String(response.status),
      details: errorPayload?.details,
      hint: errorPayload?.hint,
    };
  }

  return { data: null, error: lastError ?? { message: "Error al guardar el alimento manual" } };
}

async function deleteFoodItem({
  supabaseUrl,
  serviceRoleKey,
  anonKey,
  userToken,
  id,
}: {
  supabaseUrl: string;
  serviceRoleKey?: string;
  anonKey: string;
  userToken: string;
  id: string;
}) {
  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/food_items?id=eq.${encodeURIComponent(id)}&source_type=eq.manual`;
  const attempts = buildWriteAuthAttempts({ serviceRoleKey, anonKey, userToken });
  let lastError: any = null;

  for (const attempt of attempts) {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        apikey: attempt.apikey,
        Authorization: `Bearer ${attempt.authorization}`,
        Prefer: "return=minimal",
      },
    });

    if (response.ok) return { error: null };

    const errorPayload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) }));
    logManualFoodStep("supabase_delete_error", {
      id,
      status: response.status,
      code: errorPayload?.code,
      message: errorPayload?.message || errorPayload?.error || response.statusText,
      details: errorPayload?.details,
      hint: errorPayload?.hint,
    });
    lastError = {
      message: errorPayload?.message || errorPayload?.error || response.statusText,
      code: errorPayload?.code || String(response.status),
      details: errorPayload?.details,
      hint: errorPayload?.hint,
    };
  }

  return { error: lastError ?? { message: "Error al eliminar el alimento manual" } };
}

export default async function handler(req: any, res: any) {
  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ error: "Sesión requerida" });

  const config = getSupabaseConfig();
  if (!config) return res.status(500).json({ error: "Supabase no está configurado" });

  const admin = await verifyAdmin(config.supabaseUrl, config.supabaseAnonKey, token);
  if (!admin.ok) return res.status(admin.status).json({ error: admin.error });

  if (req.method === "GET") {
    const response = await fetch(
      `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/food_items?select=${FOOD_ITEM_SELECT}&source_type=eq.manual&order=nombre.asc`,
      {
        headers: buildReadHeaders({
          serviceRoleKey: config.supabaseServiceRoleKey,
          anonKey: config.supabaseAnonKey,
          userToken: token,
        }),
      },
    );
    const payload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) }));
    if (!response.ok) return res.status(response.status).json({ error: payload?.message || payload?.error || "No se pudieron cargar los alimentos manuales", code: payload?.code });
    return res.status(200).json({ data: Array.isArray(payload) ? payload : [] });
  }

  const body = await readBody(req);
  logManualFoodStep("request_body", {
    method: req.method,
    body,
  });
  if (req.method === "DELETE") {
    const id = String(body?.id ?? req.query?.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "Falta el ID del alimento" });
    const { error } = await deleteFoodItem({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
      anonKey: config.supabaseAnonKey,
      userToken: token,
      id,
    });
    if (error) return res.status(400).json({ error: error.message, detail: error.details, code: error.code, hint: error.hint });
    return res.status(200).json({ ok: true });
  }

  const payload = normalizePayload(body);
  logManualFoodStep("normalized_payload", {
    method: req.method,
    payload,
  });
  if (!payload.nombre) return res.status(400).json({ error: "El nombre del alimento es obligatorio" });
  const validationErrors = validatePayload(payload);
  if (validationErrors.length) {
    logManualFoodStep("payload_validation_error", {
      validationErrors,
      payload,
    });
    return res.status(400).json({
      error: "El alimento manual tiene datos incompletos o inválidos.",
      detail: validationErrors.join(" · "),
      code: "manual_food_invalid_payload",
    });
  }

  if (req.method === "POST") {
    const { duplicate, error: duplicateError } = await findManualDuplicate({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
      anonKey: config.supabaseAnonKey,
      userToken: token,
      normalizedName: payload.nombre_normalizado,
    });
    if (duplicateError) {
      return res.status(400).json({
        error: "No se pudo comprobar si el alimento manual ya existe.",
        detail: duplicateError?.message || duplicateError?.error || "Consulta de duplicados fallida",
        code: duplicateError?.code,
        hint: duplicateError?.hint,
      });
    }
    if (duplicate) {
      return res.status(409).json({
        error: `Ya existe un alimento manual con ese nombre: ${duplicate.nombre}`,
        code: "manual_food_duplicate",
      });
    }

    const { data, error } = await writeFoodItem({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
      anonKey: config.supabaseAnonKey,
      userToken: token,
      method: "POST",
      payload,
    });

    if (error) return res.status(400).json(normalizeWriteError(error));
    return res.status(200).json({ data });
  }

  const id = String(body?.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "Falta el ID del alimento" });

  const { duplicate, error: duplicateError } = await findManualDuplicate({
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
    anonKey: config.supabaseAnonKey,
    userToken: token,
    normalizedName: payload.nombre_normalizado,
    excludeId: id,
  });
  if (duplicateError) {
    return res.status(400).json({
      error: "No se pudo comprobar si el alimento manual ya existe.",
      detail: duplicateError?.message || duplicateError?.error || "Consulta de duplicados fallida",
      code: duplicateError?.code,
      hint: duplicateError?.hint,
    });
  }
  if (duplicate) {
    return res.status(409).json({
      error: `Ya existe otro alimento manual con ese nombre: ${duplicate.nombre}`,
      code: "manual_food_duplicate",
    });
  }

  const { data, error } = await writeFoodItem({
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
    anonKey: config.supabaseAnonKey,
    userToken: token,
    method: "PATCH",
    id,
    payload,
  });

  if (error) return res.status(400).json(normalizeWriteError(error));
  return res.status(200).json({ data });
}
