import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ valid: false, error: "Falta token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await supabase.from("invitations").select("id, status, expires_at, email").eq("token", token).maybeSingle();
    if (!data) return new Response(JSON.stringify({ valid: false, redirectToLogin: true, error: "Inicia sesión con tu correo y contraseña." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (data.status !== "pending") return new Response(JSON.stringify({ valid: false, used: true, redirectToLogin: true, error: "Tu cuenta ya fue creada. Inicia sesión con tu correo y contraseña." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (new Date(data.expires_at) < new Date()) return new Response(JSON.stringify({ valid: false, redirectToLogin: true, error: "Inicia sesión con tu correo y contraseña." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ valid: true, email: data.email }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ valid: false, error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
