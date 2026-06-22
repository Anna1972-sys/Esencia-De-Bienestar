import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Item = {
  to: string;
  label: string;
  desc: string;
  emoji: string;
  gradient: string;
};

const groups: { title: string; items: Item[] }[] = [
  {
    title: "Contenido",
    items: [
      { to: "/app/admin/recetas",            label: "Recetas",                 desc: "Crear y editar recetas",                    emoji: "🍽️", gradient: "from-rose-100 via-pink-100 to-fuchsia-100" },
      { to: "/app/admin/recetas-usuarias",   label: "Recetas de usuarias",     desc: "Revisar recetas de clientas",               emoji: "✨", gradient: "from-pink-100 via-fuchsia-100 to-purple-100" },
      
      { to: "/app/admin/recursos",           label: "Vídeos y guías",          desc: "Contenido en vídeo",                        emoji: "🎥", gradient: "from-purple-100 via-violet-100 to-pink-100" },
      { to: "/app/admin/movimiento",         label: "Movimiento y ejercicio",  desc: "Entrenamientos y rutinas",                  emoji: "💪", gradient: "from-rose-100 via-pink-100 to-purple-100" },
      { to: "/app/admin/nutricion",          label: "Nutrición deportiva",     desc: "Alimentación y batidos",                    emoji: "🍎", gradient: "from-pink-100 via-rose-100 to-fuchsia-100" },
      { to: "/app/admin/retos",              label: "Retos de 5 días",         desc: "Crear y editar retos",                      emoji: "🔥", gradient: "from-fuchsia-100 via-pink-100 to-rose-100" },
    ],
  },
  {
    title: "Herramientas de usuario",
    items: [
      { to: "/app/admin/lista-compra",       label: "Lista de compra",         desc: "Productos y categorías",                    emoji: "🛒", gradient: "from-rose-100 via-pink-100 to-fuchsia-100" },
      { to: "/app/admin/diario",             label: "Diario",                  desc: "Preguntas del diario",                      emoji: "📔", gradient: "from-violet-100 via-purple-100 to-fuchsia-100" },
      { to: "/app/admin/progreso",           label: "Progreso",                desc: "Métricas y objetivos",                      emoji: "📈", gradient: "from-pink-100 via-fuchsia-100 to-violet-100" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { to: "/app/admin/usuarios",           label: "Usuarios",                desc: "Ver usuarias y permisos",                   emoji: "👥", gradient: "from-purple-100 via-fuchsia-100 to-pink-100" },
      { to: "/app/admin/invitaciones",       label: "Invitaciones",            desc: "Crear y revocar invitaciones",              emoji: "✉️", gradient: "from-fuchsia-100 via-pink-100 to-rose-100" },
      { to: "/app/admin/configuracion",      label: "Configuración",           desc: "Apariencia y textos",                       emoji: "🪷", gradient: "from-violet-100 via-purple-100 to-pink-100" },
    ],
  },
];

type Stats = {
  recipes: number | null;
  users: number | null;
  pendingInvites: number | null;
  activeChallenges: number | null;
};

function StatCard({ label, value, emoji, gradient }: { label: string; value: number | null; emoji: string; gradient: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} border border-white/60 p-4 shadow-[0_4px_18px_-8px_hsl(320_60%_50%/0.18)]`}>
      <div className="text-2xl mb-1.5 leading-none">{emoji}</div>
      <div className="text-2xl font-serif font-medium leading-none" style={{ color: "hsl(var(--plum))" }}>
        {value ?? "—"}
      </div>
      <div className="text-[11px] muted mt-1.5 leading-tight">{label}</div>
    </div>
  );
}

export default function Admin() {
  const [stats, setStats] = useState<Stats>({ recipes: null, users: null, pendingInvites: null, activeChallenges: null });

  useEffect(() => {
    (async () => {
      const [r, u, i, c] = await Promise.all([
        (supabase as any).from("recipes").select("id", { count: "exact", head: true }),
        (supabase as any).from("profiles").select("id", { count: "exact", head: true }),
        (supabase as any).from("invitations").select("id", { count: "exact", head: true }).eq("status", "pending"),
        (supabase as any).from("challenges").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        recipes: r.count ?? 0,
        users: u.count ?? 0,
        pendingInvites: i.count ?? 0,
        activeChallenges: c.count ?? 0,
      });
    })();
  }, []);

  return (
    <div className="pb-28 max-w-3xl mx-auto">
      <Link to="/app/perfil" className="text-sm muted inline-flex items-center gap-1 mb-4 hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <header className="mb-7">
        <h1 className="heading-lg tracking-tight">Panel de administración</h1>
        <p className="muted text-sm mt-1">Tu centro de control de Esencia de Bienestar.</p>
      </header>

      {/* Resumen */}
      <section className="mb-9">
        <div className="text-[11px] font-semibold muted uppercase tracking-[0.14em] mb-3 px-1">Resumen</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Recetas"               value={stats.recipes}          emoji="🍽️" gradient="from-rose-50 via-pink-50 to-fuchsia-50" />
          <StatCard label="Usuarias registradas"  value={stats.users}            emoji="👥" gradient="from-pink-50 via-fuchsia-50 to-purple-50" />
          <StatCard label="Invitaciones pendientes" value={stats.pendingInvites} emoji="✉️" gradient="from-fuchsia-50 via-purple-50 to-violet-50" />
          <StatCard label="Retos activos"         value={stats.activeChallenges} emoji="🔥" gradient="from-purple-50 via-pink-50 to-rose-50" />
        </div>
      </section>

      {/* Secciones */}
      <div className="space-y-10">
        {groups.map((g) => (
          <section key={g.title}>
            <div className="text-[11px] font-semibold muted uppercase tracking-[0.14em] mb-3 px-1">
              {g.title}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {g.items.map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  className="group relative flex items-center gap-4 px-4 py-4 rounded-2xl bg-card border border-border/50 shadow-[0_2px_10px_-4px_hsl(315_55%_45%/0.10)] hover:shadow-[0_14px_36px_-14px_hsl(320_70%_50%/0.28)] hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${s.gradient} grid place-items-center shrink-0 text-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`}>
                    <span className="leading-none">{s.emoji}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[15px] leading-tight text-foreground">{s.label}</div>
                    <div className="text-xs muted mt-1 truncate">{s.desc}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 muted shrink-0 group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
