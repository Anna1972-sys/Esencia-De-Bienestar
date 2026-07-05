import { supabase } from "@/integrations/supabase/client";

export type MacroSpecialistInput = {
  ingredientsText: string;
  servings: number;
  category?: string;
  containsHerbalife?: boolean;
  preferences?: string;
  restrictions?: string;
};

export type MacroSpecialistResult = {
  status: "verificado" | "estimado" | "pendiente de revisión";
  servings: number;
  perServing: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    micronutrients?: Record<string, number>;
  };
  totals: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    micronutrients?: Record<string, number>;
  };
  found: any[];
  notFound: any[];
  missingGrams: any[];
  debug?: any[];
  warnings: any;
  envPrepared: string[];
};

const PRODUCTION_API_ORIGIN = "https://esencia-de-bienestar-49ii.vercel.app";

function isLocalPreview() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function macroSpecialistEndpoints() {
  return isLocalPreview()
    ? ["/api/macro-specialist", `${PRODUCTION_API_ORIGIN}/api/macro-specialist`]
    : ["/api/macro-specialist"];
}

export async function calculateWithMacroSpecialist(input: MacroSpecialistInput): Promise<MacroSpecialistResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const endpoints = macroSpecialistEndpoints();
  let lastFailure: any = null;

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
      },
      body: JSON.stringify(input),
    });

    const rawText = await response.text().catch(() => "");
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (parseError) {
      const nonJsonFailure = {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        body: rawText.slice(0, 1200),
        input,
        parseError,
      };
      console.error("[macro-specialist] respuesta no JSON", nonJsonFailure);
      lastFailure = nonJsonFailure;

      if (endpoint !== endpoints[endpoints.length - 1]) continue;
    }

    if (!response.ok) {
      const details = [
        data?.error,
        data?.detail,
        data?.stack ? `Stack: ${data.stack}` : "",
        data?.failedIngredient ? `Ingrediente: ${data.failedIngredient}` : "",
        data?.failedIngredients?.length ? `Ingredientes: ${data.failedIngredients.join(", ")}` : "",
      ].filter(Boolean).join(" · ");

      const httpFailure = {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        input,
        response: data ?? rawText.slice(0, 1200),
      };
      console.error("[macro-specialist] error de cálculo", httpFailure);
      lastFailure = { ...httpFailure, details };

      if (endpoint !== endpoints[endpoints.length - 1] && [404, 405].includes(response.status)) continue;
      throw new Error(details || `No se pudieron calcular los macros (${response.status})`);
    }

    if (!data) {
      const emptyFailure = { endpoint, input, status: response.status, body: rawText.slice(0, 1200) };
      console.error("[macro-specialist] respuesta vacía", emptyFailure);
      lastFailure = emptyFailure;

      if (endpoint !== endpoints[endpoints.length - 1]) continue;
      throw new Error("La API de macros respondió vacía");
    }

    console.info("[macro-specialist] respuesta recibida", {
      endpoint,
      status: data.status,
      servings: data.servings,
      found: data.found?.map((item: any) => ({ name: item.name, matchedAs: item.matchedAs, source: item.source, sourceLabel: item.sourceLabel, grams: item.grams })),
      notFound: data.notFound,
      missingGrams: data.missingGrams,
      warnings: data.warnings,
    });

    return data;
  }

  throw new Error(lastFailure?.details || "No se pudieron calcular los macros");
}

export function macrosFromSpecialist(result: MacroSpecialistResult) {
  return {
    calories: Number(result.perServing?.kcal) || 0,
    protein: Number(result.perServing?.protein) || 0,
    carbs: Number(result.perServing?.carbs) || 0,
    fat: Number(result.perServing?.fat) || 0,
    fiber: Number(result.perServing?.fiber) || 0,
    micronutrients: result.perServing?.micronutrients ?? {},
    nutrition_status: result.status === "verificado" ? "verified" : result.status === "estimado" ? "estimated" : "pending_review",
    nutrition_note: result.status,
    nutrition_source: result.warnings?.dataSource ?? "macro-specialist",
    not_found_ingredients: result.warnings?.notFound ?? [],
    missing_grams_ingredients: result.warnings?.missingGrams ?? [],
  };
}
