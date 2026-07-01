import { createClient } from "@supabase/supabase-js";

const EXPECTED_SUPABASE_REF = "vuvdnmessgwhlggzcfqb";
const EXPECTED_SUPABASE_HOST = `${EXPECTED_SUPABASE_REF}.supabase.co`;

function pickSupabaseUrl(...candidates: Array<string | undefined>) {
  const valid = candidates.filter((url): url is string => /^https:\/\//.test(url ?? ""));
  return valid.find(url => url.includes(EXPECTED_SUPABASE_HOST)) ?? valid[0] ?? "";
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanNutritionPayload(raw: any) {
  return {
    serving_size: typeof raw?.serving_size === "string" ? raw.serving_size.trim() || null : null,
    serving_grams: numberOrNull(raw?.serving_grams),
    serving_calories: numberOrNull(raw?.serving_calories),
    serving_protein: numberOrNull(raw?.serving_protein),
    serving_carbs: numberOrNull(raw?.serving_carbs),
    serving_sugars: numberOrNull(raw?.serving_sugars),
    serving_fat: numberOrNull(raw?.serving_fat),
    serving_saturated_fat: numberOrNull(raw?.serving_saturated_fat),
    serving_fiber: numberOrNull(raw?.serving_fiber),
    serving_salt: numberOrNull(raw?.serving_salt),
    calories: numberOrNull(raw?.calories),
    protein: numberOrNull(raw?.protein),
    carbs: numberOrNull(raw?.carbs),
    sugars: numberOrNull(raw?.sugars),
    fat: numberOrNull(raw?.fat),
    saturated_fat: numberOrNull(raw?.saturated_fat),
    fiber: numberOrNull(raw?.fiber),
    salt: numberOrNull(raw?.salt),
    source: typeof raw?.source === "string" ? raw.source.trim() || "Etiqueta nutricional pendiente de revisión" : "Etiqueta nutricional pendiente de revisión",
    confidence_notes: typeof raw?.confidence_notes === "string" ? raw.confidence_notes.trim() : "",
  };
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
  if (roleError || !isAdmin) return { ok: false, status: 403, error: "Solo la administradora puede leer etiquetas" };

  return { ok: true, status: 200, error: "" };
}

function extractResponseText(payload: any) {
  if (payload?.output_text) return String(payload.output_text);
  const chunks: string[] = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.text) chunks.push(String(content.text));
    }
  }
  return chunks.join("\n");
}

function parseJsonText(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La etiqueta no devolvió JSON válido");
    return JSON.parse(match[0]);
  }
}

async function readWithOpenAI(apiKey: string, body: any) {
  const prompt = `Lee esta etiqueta nutricional en español.
Devuelve SOLO JSON, sin markdown.
No inventes datos: si un valor no aparece claro, pon null.
No marques nada como verificado.
Los valores por 100 g deben ir en: calories, protein, carbs, sugars, fat, saturated_fat, fiber, salt.
Los valores por ración deben ir en: serving_calories, serving_protein, serving_carbs, serving_sugars, serving_fat, serving_saturated_fat, serving_fiber, serving_salt.
El tamaño de ración textual va en serving_size y los gramos de ración en serving_grams.
Incluye source y confidence_notes.
Formato exacto:
{"serving_size":null,"serving_grams":null,"serving_calories":null,"serving_protein":null,"serving_carbs":null,"serving_sugars":null,"serving_fat":null,"serving_saturated_fat":null,"serving_fiber":null,"serving_salt":null,"calories":null,"protein":null,"carbs":null,"sugars":null,"fat":null,"saturated_fat":null,"fiber":null,"salt":null,"source":"Etiqueta nutricional pendiente de revisión","confidence_notes":""}`;

  if (String(body.mimeType || "").startsWith("image/")) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: body.dataUrl } },
            ],
          },
        ],
      }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${text.slice(0, 600)}`);
    const payload = JSON.parse(text);
    return parseJsonText(payload?.choices?.[0]?.message?.content ?? "");
  }

  if (body.mimeType === "application/pdf") {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_file", filename: body.fileName || "etiqueta.pdf", file_data: body.dataUrl },
            ],
          },
        ],
      }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${text.slice(0, 600)}`);
    return parseJsonText(extractResponseText(JSON.parse(text)));
  }

  throw new Error("Formato no admitido. Sube una imagen o un PDF de la etiqueta.");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin.ok) return res.status(admin.status).json({ error: admin.error });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY no está configurada" });

  const body = req.body ?? {};
  if (!body.dataUrl || !body.mimeType) {
    return res.status(400).json({ error: "Falta el archivo de etiqueta" });
  }

  try {
    const raw = await readWithOpenAI(apiKey, body);
    return res.status(200).json(cleanNutritionPayload(raw));
  } catch (error: any) {
    console.error("[read-nutrition-label] error", error);
    return res.status(422).json({
      error: "No se pudo leer la etiqueta con suficiente claridad. Puedes completar los datos manualmente.",
      detail: error?.message,
    });
  }
}
