import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// action: "suspend" | "restore" | "set_role"
// For suspend: optional durationHours (default ~100 years)
// For set_role: role: "admin" | "client", grant: boolean
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "No autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const { userId, action } = body as { userId?: string; action?: string };
    if (!userId || !action) return json({ ok: false, error: "Faltan parámetros" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user?.id) return json({ ok: false, error: "Sesión inválida" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) return json({ ok: false, error: "Acceso denegado" }, 403);

    if (action === "suspend") {
      if (callerId === userId) return json({ ok: false, error: "No puedes suspender tu propia cuenta" }, 400);
      const hours = Math.max(1, Math.min(876000, Number(body.durationHours) || 876000));
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: `${hours}h` } as any);
      if (error) return json({ ok: false, error: error.message }, 500);
      // Also revoke active sessions so the user is signed out everywhere
      try { await (admin.auth.admin as any).signOut(userId, "global"); } catch (_) {}
      return json({ ok: true });
    }

    if (action === "restore") {
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" } as any);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "set_role") {
      const role = body.role as string;
      const grant = !!body.grant;
      if (!["admin", "client"].includes(role)) return json({ ok: false, error: "Rol inválido" }, 400);
      if (callerId === userId && role === "admin" && !grant) {
        return json({ ok: false, error: "No puedes quitarte tu rol de admin" }, 400);
      }
      if (grant) {
        const { error } = await admin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
        if (error) return json({ ok: false, error: error.message }, 500);
      } else {
        const { error } = await admin.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) return json({ ok: false, error: error.message }, 500);
      }
      return json({ ok: true });
    }

    return json({ ok: false, error: "Acción no soportada" }, 400);
  } catch (e) {
    console.error("admin-update-user error", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
