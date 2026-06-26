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
  };
  totals: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  found: any[];
  notFound: any[];
  missingGrams: any[];
  debug?: any[];
  warnings: any;
  envPrepared: string[];
};

export async function calculateWithMacroSpecialist(input: MacroSpecialistInput): Promise<MacroSpecialistResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const response = await fetch("/api/macro-specialist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "No se pudieron calcular los macros");
  return data;
}

export function macrosFromSpecialist(result: MacroSpecialistResult) {
  return {
    calories: Number(result.perServing?.kcal) || 0,
    protein: Number(result.perServing?.protein) || 0,
    carbs: Number(result.perServing?.carbs) || 0,
    fat: Number(result.perServing?.fat) || 0,
    fiber: Number(result.perServing?.fiber) || 0,
    nutrition_status: result.status === "verificado" ? "verified" : result.status === "estimado" ? "estimated" : "pending_review",
    nutrition_note: result.status,
    nutrition_source: result.warnings?.dataSource ?? "macro-specialist",
    not_found_ingredients: result.warnings?.notFound ?? [],
    missing_grams_ingredients: result.warnings?.missingGrams ?? [],
  };
}
