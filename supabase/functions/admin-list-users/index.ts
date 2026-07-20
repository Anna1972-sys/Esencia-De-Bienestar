import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta ${name} en la función admin-list-users`);
  return value;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "No autenticado" }, 401);

    const SUPABASE_URL = requiredEnv("SUPABASE_URL");
    const SERVICE = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const ANON = requiredEnv("SUPABASE_ANON_KEY");

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user?.id) {
      return json({ ok: false, error: userErr?.message ? `Sesión inválida: ${userErr.message}` : "Sesión inválida" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (roleErr) return json({ ok: false, error: `No se pudo comprobar el rol de administradora: ${roleErr.message}` }, 500);
    if (!isAdmin) return json({ ok: false, error: "Acceso denegado" }, 403);

    // Aggregate all auth users (paginated)
    const all: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return json({ ok: false, error: `Supabase Auth no devolvió usuarios: ${error.message}` }, 500);
      all.push(...(data?.users ?? []));
      if (!data || data.users.length < 200) break;
      page++;
      if (page > 25) break; // safety
    }

    const [{ data: profiles, error: profilesErr }, { data: roles, error: rolesErr }] = await Promise.all([
      admin.from("profiles").select("id, display_name, created_at"),
      admin.from("user_roles").select("user_id, role"),
    ]);
    if (profilesErr) return json({ ok: false, error: `No se pudieron leer perfiles: ${profilesErr.message}` }, 500);
    if (rolesErr) return json({ ok: false, error: `No se pudieron leer roles: ${rolesErr.message}` }, 500);
    const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
    const rolesMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });

    const users = all.map((u) => {
      const p = profileMap.get(u.id);
      const bannedUntil = (u as any).banned_until ?? null;
      const isBanned = bannedUntil ? new Date(bannedUntil).getTime() > Date.now() : false;
      return {
        id: u.id,
        email: u.email ?? null,
        display_name: p?.display_name ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        banned_until: bannedUntil,
        is_banned: isBanned,
        roles: rolesMap.get(u.id) ?? [],
      };
    });

    return json({ ok: true, users, count: users.length });
  } catch (e) {
    console.error("admin-list-users error", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
