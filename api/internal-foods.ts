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
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
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

  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return res.status(401).json({ error: "Sesión no válida" });

  const { data, error } = await (supabase as any)
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
