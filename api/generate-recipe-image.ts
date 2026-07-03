import { createClient } from "@supabase/supabase-js";

const EXPECTED_SUPABASE_REF = "vuvdnmessgwhlggzcfqb";
const EXPECTED_SUPABASE_HOST = `${EXPECTED_SUPABASE_REF}.supabase.co`;

function pickSupabaseUrl(...candidates: Array<string | undefined>) {
  const valid = candidates.filter((url): url is string => /^https:\/\//.test(url ?? ""));
  return valid.find(url => url.includes(EXPECTED_SUPABASE_HOST)) ?? valid[0] ?? "";
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function ingredientLabel(item: any) {
  if (typeof item === "string") return cleanText(item);
  return cleanText(`${item?.quantity ?? ""} ${item?.name ?? ""}`);
}

function buildFoodPhotoPrompt(title: string, ingredients: string[]) {
  const cleanTitle = cleanText(title) || "healthy homemade recipe";
  const cleanIngredients = ingredients.map(cleanText).filter(Boolean).slice(0, 14);

  return [
    "Create an ultra-realistic professional food photograph for a wellness recipe app.",
    `Dish title: ${cleanTitle}.`,
    cleanIngredients.length ? `Visible ingredients to represent: ${cleanIngredients.join(", ")}.` : "",
    "Style: natural daylight, premium healthy cooking, appetizing but realistic, clean plate, soft shadows, warm wellness feeling.",
    "The image must match the ingredients and should look like a real finished dish, not a collage.",
    "No text, no labels, no packaging, no hands, no brand logos, no watermark.",
    "Composition: centered dish, close enough to be attractive, enough margin for a mobile recipe card.",
  ].filter(Boolean).join(" ");
}

async function verifySupabaseSession(authHeader: string | undefined) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Debes iniciar sesión para crear la imagen" };

  const supabaseUrl = pickSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 500, error: "La conexión con Supabase no está configurada en este despliegue" };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { ok: false, status: 401, error: "Sesión no válida. Vuelve a iniciar sesión." };
  }

  return { ok: true, status: 200, error: "" };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const session = await verifySupabaseSession(req.headers.authorization);
  if (!session.ok) {
    return res.status(session.status).json({ error: session.error });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY no está configurada en Vercel" });
  }

  const body = req.body ?? {};
  const recipe = body.recipe ?? {};
  const title = cleanText(body.title ?? recipe.title);
  const ingredients = Array.isArray(body.ingredients ?? recipe.ingredients)
    ? (body.ingredients ?? recipe.ingredients).map(ingredientLabel).filter(Boolean)
    : [];

  if (!title && ingredients.length === 0) {
    return res.status(400).json({ error: "Necesito una receta o ingredientes para crear la imagen" });
  }

  const prompt = buildFoodPhotoPrompt(title, ingredients);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.message || data?.error || "No se pudo generar la imagen";
      throw new Error(`OpenAI ${response.status}: ${message}`);
    }

    const imageData = data?.data?.[0];
    const imageUrl = imageData?.b64_json
      ? `data:image/png;base64,${imageData.b64_json}`
      : imageData?.url;

    if (!imageUrl) {
      throw new Error("OpenAI no devolvió una imagen");
    }

    return res.status(200).json({ image_url: imageUrl });
  } catch (err: any) {
    const message = err?.name === "AbortError"
      ? "La imagen ha tardado demasiado. Inténtalo de nuevo."
      : err?.message || "Error generando imagen";
    return res.status(500).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
}
