import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "No autenticado" }, 401);

    const { userId } = await req.json();
    if (!userId || typeof userId !== "string") return json({ ok: false, error: "Falta userId" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user?.id) return json({ ok: false, error: "Sesión inválida" }, 401);
    const callerId = userData.user.id;
    if (callerId === userId) return json({ ok: false, error: "No puedes eliminar tu propia cuenta" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (roleErr || !isAdmin) return json({ ok: false, error: "Acceso denegado" }, 403);

    // Best-effort cleanup of user-owned rows
    const tables = [
      "saved_recipes", "meal_plans", "shopping_list_items", "wellness_entries",
      "wellness_goals", "progress_metrics", "challenge_progress", "recipes",
      "user_roles", "profiles",
    ];
    for (const t of tables) {
      const col = t === "profiles" ? "id" : "user_id";
      const { error } = await admin.from(t).delete().eq(col, userId);
      if (error) console.error(`delete ${t} failed`, error.message);
    }

    // Invalidate any invitations sent to the user's email
    const { data: target } = await admin.auth.admin.getUserById(userId);
    if (target?.user?.email) {
      await admin.from("invitations").delete().eq("email", target.user.email);
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) return json({ ok: false, error: delErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    console.error("admin-delete-user error", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
