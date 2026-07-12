import { createClient } from "@supabase/supabase-js";
import { inflateSync } from "node:zlib";

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

class GeneratedImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeneratedImageValidationError";
  }
}

type PreparedGeneratedImage = {
  contentType: string;
  buffer: Buffer;
};

function buildFoodPhotoPrompt(title: string, ingredients: string[], preparation: string[] = [], retryReason = "") {
  const cleanTitle = cleanText(title) || "healthy homemade recipe";
  const cleanIngredients = ingredients.map(cleanText).filter(Boolean).slice(0, 14);
  const cleanPreparation = preparation.map(cleanText).filter(Boolean).slice(0, 6);

  return [
    `Professional hyperrealistic food photography of ${cleanTitle}, beautiful and appetizing gourmet presentation, faithful to the exact recipe.`,
    cleanIngredients.length ? `Use only these parser-recognized recipe ingredients, without inventing anything else: ${cleanIngredients.join(", ")}.` : "",
    cleanPreparation.length ? `Use these preparation cues only to guide the final plating: ${cleanPreparation.join(" ")}` : "",
    "The finished dish must match the recipe title and preparation exactly: if it says steak, show steak; if it says beef strips, show strips; if it says salad, show a salad; if it says sauté, show a sauté. Never change the type of dish.",
    "The main ingredient must clearly dominate the dish. Secondary ingredients must appear in natural smaller proportions, never filling the plate unless they are the main ingredient.",
    "Do not fill the plate with a secondary ingredient. Small ingredients such as peas must appear only as a modest natural accent unless they are the main ingredient.",
    "The plate is a white ceramic plate or shallow white bowl, placed on a clean white or very light neutral surface.",
    "Lighting is soft natural daylight from a side window, creating realistic soft-angled shadows and diffused highlights.",
    "Camera: 50mm lens, f/2.8 aperture, shallow depth of field, sharp focus on the central food texture and softly blurred background.",
    "All ingredients must look freshly cooked and completely real, with natural imperfections, varied shapes, realistic moisture, and vibrant but natural colors.",
    "Meat must show natural browning, fibers and juices. Vegetables must have irregular shapes. Mushrooms must not repeat identical orientation or shape. Onion, when present, should be integrated naturally into the sauce or sauté.",
    "If the dish is hot, include only a subtle realistic plume of steam and tiny natural condensation highlights on glossy ingredients, never exaggerated.",
    "The white bowl or plate must be the absolute hero and occupy approximately 75–85% of the image area, with the food filling the dish clearly.",
    "Keep the composition tight, elegant, asymmetric and realistic: most ingredients should appear inside the bowl or plate, naturally arranged and easy to recognize.",
    "Do not invent ingredients, garnishes, side dishes, sauces, brands, packaging, hands, people, text or logos.",
    "Strictly avoid plastic, artificial, cartoonish, 3D render, synthetic, overexposed, empty or almost white images.",
    "Vertical 4:5, high resolution, optimized for a mobile recipe app.",
    retryReason ? `Important retry correction: the previous generated image was rejected because ${retryReason}. Regenerate with the main food clearly visible, stronger natural contrast and a non-empty plate while keeping the white background and white plate.` : "",
  ].filter(Boolean).join(" ");
}

function paethPredictor(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function analyzePngContrast(buffer: Buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  const channelsByColorType: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const channels = channelsByColorType[colorType];
  if (!width || !height || bitDepth !== 8 || !channels || interlace !== 0 || idatChunks.length === 0) return null;

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const rowBytes = width * channels;
  const bytesPerPixel = channels;
  const previous = Buffer.alloc(rowBytes);
  const current = Buffer.alloc(rowBytes);
  let readOffset = 0;
  let count = 0;
  let whiteCount = 0;
  let colorCount = 0;
  let mean = 0;
  let m2 = 0;
  let minLum = 255;
  let maxLum = 0;
  const sampleX = Math.max(1, Math.floor(width / 180));
  const sampleY = Math.max(1, Math.floor(height / 180));

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[readOffset];
    readOffset += 1;
    inflated.copy(current, 0, readOffset, readOffset + rowBytes);
    readOffset += rowBytes;

    for (let i = 0; i < rowBytes; i += 1) {
      const left = i >= bytesPerPixel ? current[i - bytesPerPixel] : 0;
      const up = previous[i] ?? 0;
      const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
      if (filter === 1) current[i] = (current[i] + left) & 255;
      else if (filter === 2) current[i] = (current[i] + up) & 255;
      else if (filter === 3) current[i] = (current[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) current[i] = (current[i] + paethPredictor(left, up, upLeft)) & 255;
    }

    if (y % sampleY === 0) {
      for (let x = 0; x < width; x += sampleX) {
        const pixel = x * channels;
        const r = channels === 1 || channels === 2 ? current[pixel] : current[pixel];
        const g = channels === 1 || channels === 2 ? current[pixel] : current[pixel + 1];
        const b = channels === 1 || channels === 2 ? current[pixel] : current[pixel + 2];
        const a = channels === 4 ? current[pixel + 3] : channels === 2 ? current[pixel + 1] : 255;
        if (a < 16) continue;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const rgbMax = Math.max(r, g, b);
        const rgbMin = Math.min(r, g, b);
        const saturation = rgbMax ? (rgbMax - rgbMin) / rgbMax : 0;
        count += 1;
        if (lum > 245 && saturation < 0.06) whiteCount += 1;
        if (saturation > 0.12 && lum < 245) colorCount += 1;
        const delta = lum - mean;
        mean += delta / count;
        m2 += delta * (lum - mean);
        minLum = Math.min(minLum, lum);
        maxLum = Math.max(maxLum, lum);
      }
    }
    current.copy(previous);
  }

  const variance = count > 1 ? m2 / (count - 1) : 0;
  return {
    width,
    height,
    nonWhiteRatio: count ? (count - whiteCount) / count : 0,
    colorRatio: count ? colorCount / count : 0,
    contrast: Math.sqrt(variance),
    luminanceRange: maxLum - minLum,
  };
}

function validateGeneratedFoodImage(image: PreparedGeneratedImage) {
  if (!image.contentType.startsWith("image/")) {
    return { ok: false, reason: "el archivo devuelto no es una imagen válida" };
  }
  if (image.buffer.length < 25_000) {
    return { ok: false, reason: "la imagen parece vacía o demasiado pequeña" };
  }

  const analysis = image.contentType.includes("png") ? analyzePngContrast(image.buffer) : null;
  if (!analysis) return { ok: true, reason: "" };
  if (analysis.width < 400 || analysis.height < 500 || analysis.height <= analysis.width) {
    return { ok: false, reason: "la imagen no mantiene un formato vertical adecuado" };
  }
  if (analysis.nonWhiteRatio < 0.14) {
    return { ok: false, reason: "la imagen es prácticamente blanca o no muestra comida suficiente" };
  }
  if (analysis.contrast < 16 || analysis.luminanceRange < 70) {
    return { ok: false, reason: "la imagen no tiene contraste suficiente para ver bien el plato" };
  }
  if (analysis.colorRatio < 0.025) {
    return { ok: false, reason: "no se detectan colores suficientes de comida real" };
  }
  return { ok: true, reason: "" };
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

async function prepareGeneratedImage(imageUrl: string): Promise<PreparedGeneratedImage> {
  const fromDataUrl = imageUrl.startsWith("data:image/")
    ? bufferFromDataUrl(imageUrl)
    : null;

  if (fromDataUrl) return fromDataUrl;

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("No se pudo descargar la imagen generada para validarla.");
  }

  return {
    contentType: imageResponse.headers.get("content-type") || "image/png",
    buffer: Buffer.from(await imageResponse.arrayBuffer()),
  };
}

async function uploadGeneratedImageToStorage(params: {
  supabaseUrl: string;
  userId: string;
  imageUrl: string;
  title: string;
  preparedImage?: PreparedGeneratedImage;
}) {
  const serviceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceRoleKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para guardar la imagen generada en Storage.");
  }

  let contentType = params.preparedImage?.contentType ?? "image/png";
  let buffer: Buffer | null = params.preparedImage?.buffer ?? null;
  const fromDataUrl = !buffer && params.imageUrl.startsWith("data:image/")
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
  const preparation = Array.isArray(body.preparation ?? recipe.steps)
    ? (body.preparation ?? recipe.steps).map(cleanText).filter(Boolean)
    : [];

  if (!title && ingredients.length === 0) {
    return res.status(400).json({ error: "Necesito una receta o ingredientes para crear la imagen" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);

  try {
    let imageUrl = "";
    let preparedImage: PreparedGeneratedImage | null = null;
    let retryReason = "";
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const prompt = buildFoodPhotoPrompt(title, ingredients, preparation, retryReason);
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
          size: process.env.OPENAI_IMAGE_SIZE || "1024x1536",
          n: 1,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error?.message || data?.error || "No se pudo generar la imagen";
        throw new Error(`OpenAI ${response.status}: ${message}`);
      }

      const imageData = data?.data?.[0];
      imageUrl = imageData?.b64_json
        ? `data:image/png;base64,${imageData.b64_json}`
        : imageData?.url;

      if (!imageUrl) {
        throw new Error("OpenAI no devolvió una imagen");
      }

      preparedImage = await prepareGeneratedImage(imageUrl);
      const validation = validateGeneratedFoodImage(preparedImage);
      if (validation.ok) break;

      retryReason = validation.reason;
      console.warn("[generate-recipe-image] imagen rechazada por validación", {
        attempt,
        reason: retryReason,
      });
      imageUrl = "";
      preparedImage = null;
    }

    if (!imageUrl || !preparedImage) {
      throw new GeneratedImageValidationError(`La imagen generada fue rechazada porque ${retryReason || "no superó la validación visual mínima"}.`);
    }

    try {
      const stored = await uploadGeneratedImageToStorage({
        supabaseUrl: session.supabaseUrl,
        userId: session.userId,
        imageUrl,
        title,
        preparedImage,
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
