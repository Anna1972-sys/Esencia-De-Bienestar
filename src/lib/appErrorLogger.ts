import { supabase } from "@/integrations/supabase/client";

export type AppErrorArea = "carga" | "supabase" | "recetas" | "aplicacion";

type AppErrorInput = {
  area: AppErrorArea;
  action: string;
  error: unknown;
  path?: string;
  userMessage?: string;
};

const messageFromError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String((error as any).message);
  return "Error sin detalle";
};

const safeDetail = (error: unknown) => {
  if (!error || typeof error !== "object") return null;
  const source = error as Record<string, unknown>;
  return {
    name: source.name ? String(source.name) : undefined,
    code: source.code ? String(source.code) : undefined,
    status: typeof source.status === "number" ? source.status : undefined,
  };
};

export async function recordAppError(input: AppErrorInput) {
  try {
    const { data } = await supabase.auth.getUser();
    await (supabase as any).from("app_error_logs").insert({
      user_id: data.user?.id ?? null,
      area: input.area,
      action: input.action.slice(0, 160),
      message: messageFromError(input.error).slice(0, 1000),
      user_message: input.userMessage?.slice(0, 500) ?? null,
      path: (input.path ?? window.location.pathname).slice(0, 300),
      technical_detail: safeDetail(input.error),
    });
  } catch {
    // Registrar un error nunca debe afectar al funcionamiento normal.
  }
}
