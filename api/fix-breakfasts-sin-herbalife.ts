import { createClient } from "@supabase/supabase-js";

type Macro = { calories: number; protein: number; carbs: number; fat: number; fiber: number };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLIC_ANON_KEY;

const FOOD: Record<string, Macro> = {
  "leche desnatada": { calories: 34, protein: 3.4, carbs: 5, fat: 0.1, fiber: 0 },
  "tortitas de arroz": { calories: 387, protein: 8, carbs: 81, fat: 2.8, fiber: 3.2 },
  "pechuga de pavo": { calories: 110, protein: 22, carbs: 1.5, fat: 2, fiber: 0 },
  "queso fresco ligero": { calories: 98, protein: 12, carbs: 3, fat: 4, fiber: 0 },
  "yogur griego 0": { calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0 },
  fresas: { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2 },
  huevo: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0 },
  "tostada integral": { calories: 250, protein: 10, carbs: 45, fat: 4, fiber: 6.7 },
  "queso fresco batido 0": { calories: 46, protein: 8.5, carbs: 3.5, fat: 0.2, fiber: 0 },
  avena: { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6 },
  canela: { calories: 247, protein: 4, carbs: 81, fat: 1.2, fiber: 53 },
  "proteina en polvo": { calories: 390, protein: 78, carbs: 8, fat: 6, fiber: 0 },
  kiwi: { calories: 61, protein: 1.1, carbs: 14.7, fat: 0.5, fiber: 3 },
};

const recipes = [
  {
    id: "7cb65fb9-68c3-45e4-bf53-32cb7fda86f8",
    title: "Café con leche, tortitas de arroz, pavo y queso fresco",
    imageName: "desayuno-pavo-queso.svg",
    imageTitle: "Café, tortitas de arroz, pavo y queso fresco",
    ingredients: [
      "200 ml de leche desnatada con café",
      "15 g de tortitas de arroz",
      "80 g de pechuga de pavo",
      "30 g de queso fresco ligero",
    ],
    items: [
      ["leche desnatada", 200],
      ["tortitas de arroz", 15],
      ["pechuga de pavo", 80],
      ["queso fresco ligero", 30],
    ] as const,
  },
  {
    id: "c3c9c621-35ee-4790-b4d9-97db37631df7",
    title: "Yogur griego con fresas y café con leche",
    imageName: "desayuno-yogur-fresas.svg",
    imageTitle: "Yogur griego, fresas y café con leche",
    ingredients: ["200 ml de leche desnatada con café", "200 g de yogur griego natural 0 %", "80 g de fresas"],
    items: [
      ["leche desnatada", 200],
      ["yogur griego 0", 200],
      ["fresas", 80],
    ] as const,
  },
  {
    id: "086a83c2-bca0-474e-81ab-f13c2400a971",
    title: "Huevo revuelto con tostada integral y café con leche",
    imageName: "desayuno-huevo-tostada.svg",
    imageTitle: "Huevo revuelto, tostada integral y café",
    ingredients: ["200 ml de leche desnatada con café", "60 g de huevo revuelto", "30 g de tostada integral"],
    items: [
      ["leche desnatada", 200],
      ["huevo", 60],
      ["tostada integral", 30],
    ] as const,
  },
  {
    id: "ee9bcfef-d7aa-44b9-8abd-4282a3f49c4d",
    title: "Avena con queso fresco batido, canela y café",
    imageName: "desayuno-avena-canela.svg",
    imageTitle: "Avena, queso fresco batido, canela y café",
    ingredients: ["200 ml de leche desnatada con café", "100 g de queso fresco batido 0 %", "30 g de avena", "3 g de canela"],
    items: [
      ["leche desnatada", 200],
      ["queso fresco batido 0", 100],
      ["avena", 30],
      ["canela", 3],
    ] as const,
  },
  {
    id: "1a56e494-6649-44cf-af59-dd0448c71872",
    title: "Batido de proteína con kiwi",
    imageName: "desayuno-proteina-kiwi.svg",
    imageTitle: "Batido de proteína con kiwi",
    ingredients: ["12 g de proteína en polvo mezclada con 200 ml de agua", "60 g de kiwi"],
    items: [
      ["proteina en polvo", 12],
      ["kiwi", 60],
    ] as const,
  },
  {
    id: "083c3817-bff4-48bc-b42a-29686cc32810",
    title: "Fórmula sencilla para construir desayunos",
    imageName: "desayuno-formula-guia.svg",
    imageTitle: "Guía visual para construir desayunos equilibrados",
    ingredients: [],
    items: [] as const,
  },
];

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function calculate(items: readonly (readonly [string, number])[]): Macro {
  const total = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const [name, grams] of items) {
    const food = FOOD[name];
    const factor = grams / 100;
    total.calories += food.calories * factor;
    total.protein += food.protein * factor;
    total.carbs += food.carbs * factor;
    total.fat += food.fat * factor;
    total.fiber += food.fiber * factor;
  }
  return {
    calories: round(total.calories),
    protein: round(total.protein),
    carbs: round(total.carbs),
    fat: round(total.fat),
    fiber: round(total.fiber),
  };
}

function svg(title: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#fff7f9"/><stop offset="1" stop-color="#f3e7df"/></linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#d91b7b" flood-opacity=".18"/></filter>
  </defs>
  <rect width="1200" height="900" fill="url(#bg)"/>
  <circle cx="930" cy="160" r="190" fill="#e91e83" opacity=".08"/>
  <circle cx="160" cy="760" r="220" fill="#111" opacity=".05"/>
  <g filter="url(#s)">
    <rect x="145" y="150" width="910" height="580" rx="54" fill="#fff"/>
    <ellipse cx="600" cy="520" rx="310" ry="90" fill="#f2d6dc"/>
    <rect x="280" y="390" width="640" height="120" rx="60" fill="#1d1d1f" opacity=".9"/>
    <circle cx="390" cy="440" r="64" fill="#f8f1ec" stroke="#e91e83" stroke-width="8"/>
    <circle cx="535" cy="440" r="64" fill="#f8f1ec" stroke="#111" stroke-width="8"/>
    <circle cx="680" cy="440" r="64" fill="#f8f1ec" stroke="#e91e83" stroke-width="8"/>
    <rect x="765" y="362" width="95" height="155" rx="26" fill="#f4d4dc" stroke="#111" stroke-width="6"/>
    <rect x="330" y="560" width="540" height="34" rx="17" fill="#e91e83" opacity=".22"/>
    <text x="600" y="650" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#111">${title}</text>
  </g>
</svg>`;
}

async function verifyAdmin(authHeader: string | undefined) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Sesión requerida", token: "" };
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { ok: false, status: 500, error: "Supabase no está configurado", token: "" };
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { ok: false, status: 401, error: "Sesión no válida", token: "" };
  const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin");
  if (roleError || !roles?.length) return { ok: false, status: 403, error: "Solo administradoras", token: "" };
  return { ok: true, status: 200, error: "", token };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }
  const auth = await verifyAdmin(req.headers.authorization);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${auth.token}` } },
  });

  const report: any[] = [];
  for (const recipe of recipes) {
    const { data: before, error: readError } = await supabase
      .from("recipes")
      .select("id,title,category,image_url,macros,ingredients,video_url,is_library")
      .eq("id", recipe.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!before || before.category !== "desayunos_sin_herbalife" || !before.is_library) {
      report.push({ id: recipe.id, skipped: true, reason: "No pertenece a la categoría objetivo" });
      continue;
    }

    const path = `desayunos-sin-herbalife/${recipe.imageName}`;
    const svgFile = new Blob([svg(recipe.imageTitle)], { type: "image/svg+xml" });
    const { error: uploadError } = await supabase.storage.from("recipe-images").upload(path, svgFile, { upsert: true, contentType: "image/svg+xml" });
    if (uploadError) throw uploadError;
    const { data: signed, error: signError } = await supabase.storage.from("recipe-images").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signError) throw signError;

    const macros = {
      ...calculate(recipe.items),
      servings: 1,
      nutrition_status: recipe.items.length ? "estimated" : "pending_review",
      nutrition_note: recipe.items.length ? "estimado" : "pendiente de revisión",
      nutrition_source: "tabla_interna_basica_por_100g",
    };

    const { error: updateError } = await supabase.from("recipes").update({
      title: recipe.title,
      image_url: signed?.signedUrl,
      ingredients: recipe.ingredients,
      macros,
      servings: 1,
      is_high_protein: Number(macros.protein || 0) >= 25,
    }).eq("id", recipe.id);
    if (updateError) throw updateError;

    report.push({
      id: recipe.id,
      titleBefore: before.title,
      titleAfter: recipe.title,
      imageBefore: before.image_url,
      imageAfter: signed?.signedUrl,
      imageChanged: before.image_url !== signed?.signedUrl,
      macros,
      ingredients: recipe.ingredients,
      videoTouched: false,
    });
  }

  return res.status(200).json({ updated: report.length, report });
}
