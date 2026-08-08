import { supabase } from "@/integrations/supabase/client";

export type NutritionLabelData = Record<string, unknown>;

export type NutritionLabelTableCandidate = {
  id?: string;
  title?: string;
  context?: string;
  data: NutritionLabelData;
};

export async function readNutritionLabel(
  fileName: string,
  mimeType: string,
  labelUrl: string,
  dataUrl?: string,
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const response = await fetch("/api/read-nutrition-label", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
    },
    body: JSON.stringify({ fileName, mimeType, dataUrl, fileUrl: labelUrl }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail ? ` · ${payload.detail}` : "";
    throw new Error(`${payload?.error || "No se pudo leer la etiqueta"}${detail}`);
  }
  return payload as NutritionLabelData & {
    requires_admin_selection?: boolean;
    nutrition_tables?: NutritionLabelTableCandidate[];
  };
}
