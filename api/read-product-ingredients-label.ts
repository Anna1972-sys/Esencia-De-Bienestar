import { createClient } from "@supabase/supabase-js";

const EXPECTED_SUPABASE_REF = "vuvdnmessgwhlggzcfqb";
const EXPECTED_SUPABASE_HOST = `${EXPECTED_SUPABASE_REF}.supabase.co`;

function pickSupabaseUrl(...candidates: Array<string | undefined>) {
  const valid = candidates.filter((url): url is string => /^https:\/\//.test(url ?? ""));
  return valid.find(url => url.includes(EXPECTED_SUPABASE_HOST)) ?? valid[0] ?? "";
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

  if (roleError || !isAdmin) return { ok: false, status: 403, error: "Solo la administradora puede leer etiquetas de ingredientes" };

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
    if (!match) throw new Error("La etiqueta no devolvió ingredientes válidos");
    return JSON.parse(match[0]);
  }
}

function cleanIngredientsPayload(raw: any) {
  const ingredientsText = typeof raw?.ingredients_text === "string" ? raw.ingredients_text.trim() : "";
  if (!ingredientsText) throw new Error("No se han podido leer ingredientes claros en la etiqueta");
  return {
    ingredients_text: ingredientsText.slice(0, 4000),
  };
}

async function readWithOpenAI(apiKey: string, body: any) {
  const prompt = `Lee la etiqueta de ingredientes adjunta y extrae SOLO la lista de ingredientes del producto.
Devuelve SOLO JSON, sin markdown.
No inventes ingredientes ni beneficios.
No extraigas la tabla nutricional.
Si hay alérgenos o advertencias justo junto a los ingredientes, inclúyelos al final.
Mantén el texto en español y con buena puntuación.
Formato exacto:
{"ingredients_text":"Ingredientes: ..."}`;

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
    return cleanIngredientsPayload(parseJsonText(payload?.choices?.[0]?.message?.content ?? ""));
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
              { type: "input_file", filename: body.fileName || "ingredientes.pdf", file_data: body.dataUrl },
            ],
          },
        ],
      }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${text.slice(0, 600)}`);
    return cleanIngredientsPayload(parseJsonText(extractResponseText(JSON.parse(text))));
  }

  throw new Error("Formato no admitido. Sube una imagen o un PDF de la etiqueta de ingredientes.");
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
    return res.status(400).json({ error: "Falta la etiqueta de ingredientes" });
  }

  try {
    const payload = await readWithOpenAI(apiKey, body);
    return res.status(200).json(payload);
  } catch (error: any) {
    console.error("[read-product-ingredients-label] error", error);
    return res.status(422).json({
      error: "No se pudo leer la etiqueta de ingredientes. Puedes escribirla manualmente.",
      detail: error?.message,
    });
  }
}
