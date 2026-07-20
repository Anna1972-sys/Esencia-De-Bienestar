import { supabase } from "@/integrations/supabase/client";

export const RECIPE_IMAGES_BUCKET = "recipe-images";

export function recipeImagePublicUrl(path: string) {
  return supabase.storage.from(RECIPE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function normalizeRecipeImageUrl(url?: string | null) {
  const value = typeof url === "string" ? url.trim() : "";
  if (!value) return "";

  const signedMarker = `/storage/v1/object/sign/${RECIPE_IMAGES_BUCKET}/`;
  const publicMarker = `/storage/v1/object/public/${RECIPE_IMAGES_BUCKET}/`;

  if (value.includes(publicMarker)) return value;
  if (!value.includes(signedMarker)) return value;

  const [origin, signedPathWithQuery] = value.split(signedMarker);
  const signedPath = signedPathWithQuery?.split("?")[0] ?? "";
  return signedPath ? `${origin}${publicMarker}${signedPath}` : value;
}
