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
    title: "Herramientas",
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
      <Link to="/app/perfil" className="text-sm muted inline-flex items-center gap-1 mb-2 hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <header className="mb-5">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary mb-1">Esencia de Bienestar</p>
        <h1 className="heading-lg tracking-tight">Panel de administración</h1>
        <p className="muted text-sm mt-1">Tu centro de control, contenido y acompañamiento.</p>
      </header>

      <section className="challenge-premium rounded-[28px] overflow-hidden mb-8" style={{ background: "linear-gradient(140deg, #fff 0%, #fff2f8 54%, #f8f0ff 100%)" }}>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-primary">Resumen del espacio</div>
              <div className="font-serif text-2xl mt-1" style={{ color: "hsl(var(--plum))" }}>Todo en equilibrio</div>
              <p className="text-xs muted mt-1">Una vista rápida de tu comunidad y contenidos.</p>
            </div>
            <div className="h-14 w-14 rounded-2xl grid place-items-center text-3xl bg-white/75 shadow-[0_10px_22px_-16px_rgba(45,25,37,0.45)]">✦</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              ["🍽️", stats.recipes, "Recetas"],
              ["👥", stats.users, "Usuarias"],
              ["✉️", stats.pendingInvites, "Invitaciones"],
              ["🔥", stats.activeChallenges, "Retos activos"],
            ].map(([emoji, value, label]) => (
              <div key={label as string} className="rounded-2xl bg-white/70 border border-white p-3.5 shadow-[0_8px_18px_-16px_rgba(45,25,37,0.35)]">
                <div className="text-2xl leading-none">{emoji}</div>
                <div className="font-serif text-2xl leading-none mt-2" style={{ color: "hsl(var(--plum))" }}>{value ?? "—"}</div>
                <div className="text-[10px] muted mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.title}>
            <div className="flex items-center gap-3 mb-3 px-1"><div className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" /><div className="text-[11px] font-bold muted uppercase tracking-[0.16em]">{g.title}</div><div className="h-px flex-1 bg-gradient-to-l from-primary/40 to-transparent" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {g.items.map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  className="challenge-premium group relative flex items-center gap-4 px-4 py-4 rounded-[22px] bg-white/90 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${s.gradient} grid place-items-center shrink-0 text-[34px] shadow-[0_12px_22px_-16px_rgba(45,25,37,0.38)]`}>
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
