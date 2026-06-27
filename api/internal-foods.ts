import { createClient } from "@supabase/supabase-js";
import { INITIAL_INTERNAL_FOODS } from "./internal-foods-data.js";

function pickSupabaseUrl(...candidates: Array<string | undefined>) {
  return candidates.find((url): url is string => /^https:\/\//.test(url ?? "")) ?? "";
}

function getSupabaseConfig() {
  const supabaseUrl = pickSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    return res.status(200).json({
      data: INITIAL_INTERNAL_FOODS,
      source: "fallback",
      warning: "Supabase no está configurado en la API.",
    });
  }

  const authClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) return res.status(401).json({ error: "Sesión no válida" });

  const dataClient = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey || config.supabaseAnonKey,
    {
      db: { schema: "public" },
      auth: { persistSession: false, autoRefreshToken: false },
      ...(config.supabaseServiceRoleKey ? {} : { global: { headers: { Authorization: `Bearer ${token}` } } }),
    },
  );

  if (req.method === "GET") {
    const { data, error } = await (dataClient as any)
    .schema("public")
    .from("internal_foods")
    .select("id,name,synonyms,base_quantity,base_unit,calories,protein,carbs,fat,fiber,category,source,is_active")
    .order("name", { ascending: true });

    if (error) {
      console.warn("[internal-foods] Supabase read failed, using fallback", {
        code: error.code,
        message: error.message,
      });
      return res.status(200).json({
        data: INITIAL_INTERNAL_FOODS,
        source: "fallback",
        warning: error.message,
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

    const { data, error } = await (dataClient as any)
      .schema("public")
      .from("internal_foods")
      .insert(payload)
      .select("id,name,synonyms,base_quantity,base_unit,calories,protein,carbs,fat,fiber,category,source,is_active")
      .single();

    if (error) return res.status(400).json({ error: error.message, code: error.code });
    return res.status(200).json({ data });
  }

  if (req.method === "PUT") {
    const body = await readBody(req);
    const id = String(body?.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "Falta el ID del alimento" });
    const payload = normalizePayload(body);
    if (!payload.name) return res.status(400).json({ error: "El nombre del alimento es obligatorio" });

    const { data, error } = await (dataClient as any)
      .schema("public")
      .from("internal_foods")
      .update(payload)
      .eq("id", id)
      .select("id,name,synonyms,base_quantity,base_unit,calories,protein,carbs,fat,fiber,category,source,is_active")
      .single();

    if (error) return res.status(400).json({ error: error.message, code: error.code });
    return res.status(200).json({ data });
  }

  const body = await readBody(req);
  const id = String(body?.id ?? req.query?.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "Falta el ID del alimento" });

  const { error } = await (dataClient as any)
    .schema("public")
    .from("internal_foods")
    .delete()
    .eq("id", id);

  if (error) return res.status(400).json({ error: error.message, code: error.code });
  return res.status(200).json({ ok: true });
}
