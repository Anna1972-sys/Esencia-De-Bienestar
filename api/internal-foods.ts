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
    category: String(input?.category ?? "general").trim() || "general",
    source: "Tabla interna",
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
  if (!token) return res.status(401).json({ error: "Sesión requerida" });

  const config = getSupabaseConfig();
  if (!config) {
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
  if (userError || !userData?.user) return res.status(401).json({ error: "Sesión no válida" });

  if (req.method === "GET") {
    const { data, error } = await (authClient as any)
    .schema("public")
    .from("internal_foods")
    .select("id,name,synonyms,base_quantity,base_unit,calories,protein,carbs,fat,fiber,category,source,is_active")
    .order("name", { ascending: true });

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

  if (!config.supabaseServiceRoleKey) {
    return res.status(500).json({
      error: "Falta SUPABASE_SERVICE_ROLE_KEY en el backend para guardar alimentos internos de forma segura.",
    });
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

const INTERNAL_FOOD_SELECT = "id,name,synonyms,base_quantity,base_unit,calories,protein,carbs,fat,fiber,category,source,is_active";

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
  const filter = id ? `&id=eq.${encodeURIComponent(id)}` : "";
  const select = method === "DELETE" ? "" : `?select=${INTERNAL_FOOD_SELECT}${filter}`;
  const deleteFilter = method === "DELETE" ? `?id=eq.${encodeURIComponent(id ?? "")}` : "";
  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/internal_foods${select || deleteFilter}`;
  const attempts = buildWriteAuthAttempts({ serviceRoleKey, anonKey, userToken });
  let lastError: any = null;

  for (const attempt of attempts) {
    const response = await fetch(url, {
      method,
      headers: {
        apikey: attempt.apikey,
        Authorization: `Bearer ${attempt.authorization}`,
        ...(payload ? { "Content-Type": "application/json" } : {}),
        Prefer: method === "DELETE" ? "return=minimal" : "return=representation",
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });

    if (response.ok) {
      if (method === "DELETE") return { data: null, error: null };
      const rows = await response.json().catch(() => []);
      return { data: Array.isArray(rows) ? rows[0] : rows, error: null };
    }

    const errorPayload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) }));
    lastError = {
      message: errorPayload?.message || errorPayload?.error || response.statusText,
      code: errorPayload?.code || String(response.status),
      details: errorPayload?.details,
    };

    if (!/invalid api key|wrong key type|no suitable key/i.test(String(lastError.message))) break;
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
  const serviceRoleIsJwt = serviceRoleKey.startsWith("eyJ");
  const candidates = serviceRoleIsJwt
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
    if (seen.has(key)) return false;
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
