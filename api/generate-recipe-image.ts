import { createClient } from "@supabase/supabase-js";

const EXPECTED_SUPABASE_REF = "vuvdnmessgwhlggzcfqb";
const EXPECTED_SUPABASE_HOST = `${EXPECTED_SUPABASE_REF}.supabase.co`;

function pickSupabaseUrl(...candidates: Array<string | undefined>) {
  const valid = candidates.map(cleanEnvValue).filter((url): url is string => /^https:\/\//.test(url ?? ""));
  return valid.find(url => url.includes(EXPECTED_SUPABASE_HOST)) ?? valid[0] ?? "";
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
    "Create an ultra-realistic editorial gastronomic photograph for a wellness recipe app.",
    `Dish title: ${cleanTitle}.`,
    cleanIngredients.length ? `Visible ingredients to represent: ${cleanIngredients.join(", ")}.` : "",
    "Style: warm natural light, clear beige background, clean premium composition, soft shadows, appetizing but realistic.",
    "Serve the finished dish in a white ceramic bowl when it fits the recipe.",
    "The ingredients must match the recipe exactly and should look like a real finished dish, not a collage.",
    "No text, no labels, no hands, no unnecessary utensils, no commercial brands, no logos, no watermark.",
    "Composition: vertical 4:5 editorial framing, centered dish, enough margin for a mobile recipe card.",
  ].filter(Boolean).join(" ");
}

async function verifySupabaseSession(authHeader: string | undefined) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Debes iniciar sesión para crear la imagen" };

  const supabaseUrl = pickSupabaseUrl(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey = cleanEnvValue(
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLIC_ANON_KEY
  );

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

  return { ok: true, status: 200, error: "", userId: data.user.id, supabaseUrl };
}

function bufferFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1] || "image/png",
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function uploadGeneratedImageToStorage(params: {
  supabaseUrl: string;
  userId: string;
  imageUrl: string;
  title: string;
}) {
  const serviceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceRoleKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para guardar la imagen generada en Storage.");
  }

  let contentType = "image/png";
  let buffer: Buffer | null = null;
  const fromDataUrl = params.imageUrl.startsWith("data:image/")
    ? bufferFromDataUrl(params.imageUrl)
    : null;

  if (fromDataUrl) {
    contentType = fromDataUrl.contentType;
    buffer = fromDataUrl.buffer;
  } else {
    const imageResponse = await fetch(params.imageUrl);
    if (!imageResponse.ok) {
      throw new Error("No se pudo descargar la imagen generada para guardarla.");
    }
    contentType = imageResponse.headers.get("content-type") || "image/png";
    buffer = Buffer.from(await imageResponse.arrayBuffer());
  }

  if (!buffer?.length) {
    throw new Error("La imagen generada está vacía.");
  }

  const extension = contentType.includes("webp") ? "webp" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  const safeTitle = cleanText(params.title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "receta";
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `generated/${params.userId}/${safeTitle}-${randomId}.${extension}`;
  const admin = createClient(params.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: uploadError } = await admin.storage
    .from("recipe-images")
    .upload(path, buffer, { contentType, upsert: false });
  if (uploadError) throw uploadError;

  const tenYears = 60 * 60 * 24 * 365 * 10;
  const { data: signed, error: signedError } = await admin.storage
    .from("recipe-images")
    .createSignedUrl(path, tenYears);
  if (signedError || !signed?.signedUrl) {
    throw signedError ?? new Error("No se pudo preparar la URL de la imagen guardada.");
  }

  return { signedUrl: signed.signedUrl, storagePath: path };
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

    try {
      const stored = await uploadGeneratedImageToStorage({
        supabaseUrl: session.supabaseUrl,
        userId: session.userId,
        imageUrl,
        title,
      });
      return res.status(200).json({
        image_url: stored.signedUrl,
        storage_path: stored.storagePath,
        persistent: true,
      });
    } catch (storageError: any) {
      console.error("[generate-recipe-image] no se pudo guardar la imagen en Storage", storageError);
      return res.status(200).json({
        preview_url: imageUrl,
        persistent: false,
        storage_warning: storageError?.message || "La imagen se creó, pero no pudo guardarse de forma permanente.",
      });
    }
  } catch (err: any) {
    const message = err?.name === "AbortError"
      ? "La imagen ha tardado demasiado. Inténtalo de nuevo."
      : err?.message || "Error generando imagen";
    return res.status(500).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
}
