import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ingredients, title } = await req.json();
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return new Response(JSON.stringify({ error: "ingredients requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no configurada");

    const list = ingredients.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n");
    const systemPrompt = `Eres una nutricionista experta. Calcula los valores nutricionales TOTALES de una receta a partir de la lista de ingredientes con cantidades. Devuelve SIEMPRE valores numéricos enteros razonables en gramos y kcal. Si una cantidad no está clara, estima una porción estándar. Responde EXCLUSIVAMENTE con un JSON con la forma {"protein":number,"carbs":number,"fat":number,"calories":number} sin texto adicional ni markdown.`;
    const userPrompt = `Receta: ${title || "(sin título)"}\nIngredientes:\n${list}\n\nDevuelve los macros TOTALES de toda la receta.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            responseSchema: {
              type: "object",
              properties: {
                protein: { type: "number" },
                carbs: { type: "number" },
                fat: { type: "number" },
                calories: { type: "number" },
              },
              required: ["protein", "carbs", "fat", "calories"],
            },
          },
        }),
      },
    );

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Gemini error:", resp.status, t);
      if (resp.status === 429)
        return new Response(JSON.stringify({ error: "Límite alcanzado, intenta más tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      return new Response(JSON.stringify({ error: `Error de IA (${resp.status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    let macros: any = null;
    try { macros = JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      macros = m ? JSON.parse(m[0]) : null;
    }
    if (!macros) throw new Error("Respuesta de IA inválida");

    return new Response(
      JSON.stringify({
        protein: Math.round(macros.protein || 0),
        carbs: Math.round(macros.carbs || 0),
        fat: Math.round(macros.fat || 0),
        calories: Math.round(macros.calories || 0),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("calculate-macros error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
