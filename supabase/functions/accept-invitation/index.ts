import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token, email, password, name } = await req.json();
    if (!token || !email || !password) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan datos" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (String(password).length < 6) {
      return new Response(JSON.stringify({ ok: false, error: "La contraseña debe tener al menos 6 caracteres" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: inv, error: invErr } = await admin
      .from("invitations")
      .select("id, status, expires_at, email")
      .eq("token", token)
      .maybeSingle();

    if (invErr) {
      console.error("invitation lookup error", invErr);
      return new Response(JSON.stringify({ ok: false, error: "Error al validar la invitación" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) {
      return new Response(JSON.stringify({ ok: false, error: "Invitación no válida" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (inv.email && inv.email.toLowerCase() !== String(email).toLowerCase()) {
      return new Response(JSON.stringify({ ok: false, error: "El correo no coincide con la invitación" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let userId: string | null = null;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name ?? null },
    });

    if (createErr) {
      const msg = String(createErr.message ?? "").toLowerCase();
      const isDup = msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (!isDup) {
        console.error("createUser error", createErr);
        return new Response(JSON.stringify({ ok: false, error: createErr.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Find existing user by email and update their password
      let existing: any = null;
      for (let page = 1; page <= 20 && !existing; page++) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) {
          console.error("listUsers error", listErr);
          break;
        }
        existing = list.users.find((u) => (u.email ?? "").toLowerCase() === String(email).toLowerCase());
        if (!list.users.length || list.users.length < 200) break;
      }
      if (!existing) {
        return new Response(JSON.stringify({ ok: false, error: "El correo ya está registrado. Inicia sesión." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata ?? {}), display_name: name ?? existing.user_metadata?.display_name ?? null },
      });
      if (updErr) {
        console.error("updateUserById error", updErr);
        return new Response(JSON.stringify({ ok: false, error: updErr.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = existing.id;
    } else {
      userId = created.user!.id;
    }

    // Ensure profile exists
    await admin.from("profiles").upsert({ id: userId, display_name: name ?? null }, { onConflict: "id" });
    // Ensure client role exists
    await admin.from("user_roles").upsert({ user_id: userId, role: "client" }, { onConflict: "user_id,role" });

    const { error: markErr } = await admin
      .from("invitations")
      .update({ status: "used", used_by: userId, used_at: new Date().toISOString() })
      .eq("id", inv.id);
    if (markErr) console.error("mark invitation used error", markErr);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("accept-invitation fatal", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message ?? e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
