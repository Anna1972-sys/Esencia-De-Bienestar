import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

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

function gramsOrNull(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:g|gr|gramo|gramos)?$/i);
  return match ? numberOrNull(match[1]) : null;
}

export function normalizeServingFields(rawServingSize: unknown, rawServingGrams: unknown) {
  let servingSize = typeof rawServingSize === "string" ? rawServingSize.trim() || null : null;
  let servingGrams = gramsOrNull(rawServingGrams);

  if (servingSize) {
    const explicitServing = servingSize.match(/^(.*?)\s*(?:=|\/|\(|:)\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:g|gr|gramo|gramos)\s*\)?$/i);
    if (explicitServing?.[1]?.trim()) {
      servingSize = explicitServing[1]
        .trim()
        .replace(/^(?:tamaño\s+de\s+(?:la\s+)?ración|ración|porción|dosis)(?:\s+(?:diaria|recomendada|diaria\s+recomendada))?\s*[:=-]\s*/i, "")
        .trim() || null;
      if (servingGrams === null) servingGrams = numberOrNull(explicitServing[2]);
    }
  }

  return { servingSize, servingGrams };
}

function cleanNutritionPayload(raw: any) {
  const { servingSize, servingGrams } = normalizeServingFields(raw?.serving_size, raw?.serving_grams);
  return {
    short_description: typeof raw?.short_description === "string" ? raw.short_description.trim() : "",
    description: typeof raw?.description === "string" ? raw.description.trim() : "",
    ingredients_text: typeof raw?.ingredients_text === "string" ? raw.ingredients_text.trim() : "",
    serving_size: servingSize,
    serving_grams: servingGrams,
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

function cleanNutritionTable(raw: any, index: number) {
  const data = cleanNutritionPayload(raw);
  const title = typeof raw?.table_title === "string" && raw.table_title.trim()
    ? raw.table_title.trim()
    : `Tabla ${index + 1}`;
  const context = typeof raw?.table_context === "string" ? raw.table_context.trim() : "";
  return {
    id: typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : `table-${index + 1}`,
    title,
    context,
    data,
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

function isSupportedLabelMimeType(mimeType: unknown) {
  return ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"].includes(String(mimeType || "").toLowerCase());
}

function dataUrlToInlineData(dataUrl: string, fallbackMimeType: string) {
  const match = String(dataUrl).match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new Error("El archivo de etiqueta no tiene un formato válido");
  return {
    mimeType: match[1] || fallbackMimeType,
    data: match[2],
  };
}

function extractGeminiText(payload: any) {
  const chunks: string[] = [];
  for (const candidate of payload?.candidates ?? []) {
    for (const part of candidate?.content?.parts ?? []) {
      if (part?.text) chunks.push(String(part.text));
    }
  }
  return chunks.join("\n");
}

async function readWithGemini(apiKey: string, body: any) {
  const prompt = `Lee este PDF o imagen oficial de producto en español.
Devuelve SOLO JSON, sin markdown.
No inventes datos: si un valor no aparece claro, pon null.
No marques nada como verificado.
Extrae únicamente información que aparezca en el documento.
REGLA CRÍTICA SOBRE VARIAS TABLAS NUTRICIONALES:
- Si el documento contiene dos o más tablas nutricionales, NO elijas ninguna automáticamente, aunque una parezca corresponder al producto tal como se vende.
- Pon requires_admin_selection en true y devuelve TODAS las tablas en nutrition_tables, una por una y en el orden en que aparecen.
- Cada elemento de nutrition_tables debe incluir id, table_title, table_context y todos los campos nutricionales de este formato. table_context debe explicar brevemente qué representa (por ejemplo, "producto en polvo", "preparado con leche" o "por ración").
- Cuando haya varias tablas, deja los valores nutricionales de nivel superior en null: la administradora elegirá después una tabla concreta.
- No inventes ni combines valores de tablas diferentes.
Si aparece una descripción oficial del producto, devuélvela en description. Si no aparece, pon "".
Si aparece descripción oficial suficiente, crea short_description como resumen breve de 2 a 4 líneas usando solo esa información. Si no aparece, pon "".
Si aparece una lista de ingredientes, devuélvela en ingredients_text. Si no aparece, pon "".
Los valores por 100 g o por 100 ml deben ir exclusivamente en: calories, protein, carbs, sugars, fat, saturated_fat, fiber, salt.
Los valores por ración deben ir exclusivamente en: serving_calories, serving_protein, serving_carbs, serving_sugars, serving_fat, serving_saturated_fat, serving_fiber, serving_salt.
No copies, mezcles ni calcules valores entre las columnas por 100 g/100 ml y las columnas por ración.
Busca la declaración de ración en todo el documento, no solo dentro de la tabla nutricional.
Cuando sea explícita, separa el nombre o cantidad de unidades de la ración y su peso: por ejemplo, "1 sobre = 3,7 g" debe producir serving_size "1 sobre" y serving_grams 3.7; "2 cápsulas = 4 g" debe producir serving_size "2 cápsulas" y serving_grams 4; "2 cucharadas = 26 g" debe producir serving_size "2 cucharadas" y serving_grams 26.
serving_size debe contener únicamente la ración textual (por ejemplo, "1 sobre", "1 tableta", "2 cápsulas" o "2 cucharadas") y serving_grams únicamente su peso numérico en gramos, sin la letra g.
Extrae ambos datos solo cuando la relación aparezca claramente indicada. Si falta el nombre de la ración o su peso, deja el campo correspondiente en null: no lo deduzcas ni lo calcules.
Si el sodio aparece pero la sal no aparece, indica el dato en confidence_notes para revisión manual; no conviertas si no está claro.
Incluye source y confidence_notes.
Formato exacto:
{"short_description":"","description":"","ingredients_text":"","serving_size":null,"serving_grams":null,"serving_calories":null,"serving_protein":null,"serving_carbs":null,"serving_sugars":null,"serving_fat":null,"serving_saturated_fat":null,"serving_fiber":null,"serving_salt":null,"calories":null,"protein":null,"carbs":null,"sugars":null,"fat":null,"saturated_fat":null,"fiber":null,"salt":null,"source":"Etiqueta nutricional pendiente de revisión","confidence_notes":"","requires_admin_selection":false,"nutrition_tables":[]}`;

  const inlineData = dataUrlToInlineData(body.dataUrl, body.mimeType || "application/pdf");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: inlineData.mimeType,
                data: inlineData.data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${text.slice(0, 600)}`);
  return parseJsonText(extractGeminiText(JSON.parse(text)));
}

async function fileUrlToDataUrl(fileUrl: string, fallbackMimeType = "application/pdf") {
  if (!/^https:\/\//.test(fileUrl)) {
    throw new Error("La URL de la etiqueta guardada no es válida");
  }
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`No se pudo abrir la etiqueta guardada (${response.status})`);
  }
  const headerContentType = response.headers.get("content-type")?.split(";")[0];
  const contentType = headerContentType && headerContentType !== "application/octet-stream" ? headerContentType : fallbackMimeType;
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    dataUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
    mimeType: contentType || fallbackMimeType,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin.ok) return res.status(admin.status).json({ error: admin.error });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY no está configurada" });

  const body = req.body ?? {};
  if (!body.dataUrl && body.fileUrl) {
    try {
      const fileData = await fileUrlToDataUrl(String(body.fileUrl), body.mimeType || "application/pdf");
      body.dataUrl = fileData.dataUrl;
      body.mimeType = fileData.mimeType;
    } catch (error: any) {
      return res.status(422).json({
        error: "La etiqueta está guardada, pero no se pudo abrir para leerla.",
        detail: error?.message,
      });
    }
  }

  if (!body.dataUrl || !body.mimeType) {
    return res.status(400).json({ error: "Falta el archivo de etiqueta" });
  }

  if (!isSupportedLabelMimeType(body.mimeType)) {
    return res.status(415).json({ error: "Formato no soportado. Sube una etiqueta oficial en PDF, JPG, JPEG, PNG o WEBP." });
  }

  try {
    const raw = await readWithGemini(apiKey, body);
    const nutritionTables = Array.isArray(raw?.nutrition_tables)
      ? raw.nutrition_tables.map(cleanNutritionTable).filter((table: any) => table.data)
      : [];
    if (raw?.requires_admin_selection === true || nutritionTables.length > 1) {
      if (nutritionTables.length < 2) {
        return res.status(422).json({
          error: "La etiqueta parece contener varias tablas, pero no se pudieron extraer por separado.",
          detail: "Vuelve a intentarlo con una imagen más nítida o completa.",
        });
      }
      return res.status(200).json({
        requires_admin_selection: true,
        nutrition_tables: nutritionTables,
        confidence_notes: typeof raw.confidence_notes === "string" ? raw.confidence_notes : "",
      });
    }
    if (nutritionTables.length === 1) {
      return res.status(200).json(nutritionTables[0].data);
    }
    return res.status(200).json(cleanNutritionPayload(raw));
  } catch (error: any) {
    console.error("[read-nutrition-label] error", error);
    return res.status(422).json({
      error: "No se pudo leer la etiqueta con suficiente claridad. Puedes completar los datos manualmente.",
      detail: error?.message,
    });
  }
}
