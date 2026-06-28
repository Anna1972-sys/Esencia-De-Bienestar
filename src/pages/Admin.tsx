import { Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import recipesImage from "@/assets/home-recetas.png";
import userRecipesImage from "@/assets/cat-comidas.jpg";
import videosImage from "@/assets/challenge-videos.png";
import movementImage from "@/assets/home-movimiento.png";
import nutritionImage from "@/assets/home-nutrition-premium-light.png";
import macroSpecialistImage from "@/assets/admin-macro-specialist.jpg";
import challengesImage from "@/assets/home-retos.png";
import shoppingImage from "@/assets/challenge-shopping.png";
import diaryImage from "@/assets/home-diario.png";
import progressImage from "@/assets/home-progreso.png";
import usersImage from "@/assets/home-admin.png";
import invitationsImage from "@/assets/home-compra.png";
import settingsImage from "@/assets/home-biblioteca.png";
import welcomeImage from "@/assets/home-admin.png";
import settingsDeskImage from "@/assets/home-diario.png";

type Item = {
  to: string;
  label: string;
  desc: string;
  image: string;
};

const groups: { title: string; items: Item[] }[] = [
  {
    title: "Contenido",
    items: [
      { to: "/app/admin/recetas",            label: "Recetas",                 desc: "Crear y editar recetas", image: recipesImage },
      { to: "/app/admin/recetas-usuarias",   label: "Recetas generadas por usuarios",     desc: "Revisar recetas creadas con IA", image: userRecipesImage },
      { to: "/app/admin/especialista-macros", label: "Especialista en Macros", desc: "Probar cálculos nutricionales", image: macroSpecialistImage },
      { to: "/app/admin/alimentos-internos", label: "Alimentos internos", desc: "Base nutricional editable", image: macroSpecialistImage },
      
      { to: "/app/admin/recursos",           label: "Vídeos y guías",          desc: "Contenido en vídeo", image: videosImage },
      { to: "/app/admin/movimiento",         label: "Movimiento y ejercicio",  desc: "Entrenamientos y rutinas", image: movementImage },
      { to: "/app/admin/nutricion",          label: "Nutrición deportiva",     desc: "Alimentación y batidos", image: nutritionImage },
      { to: "/app/admin/retos",              label: "Retos de 5 días",         desc: "Crear y editar retos", image: challengesImage },
    ],
  },
  {
    title: "Herramientas",
    items: [
      { to: "/app/admin/lista-compra",       label: "Lista de compra",         desc: "Productos y categorías", image: shoppingImage },
      { to: "/app/admin/diario",             label: "Diario",                  desc: "Preguntas del diario", image: diaryImage },
      { to: "/app/admin/progreso",           label: "Progreso",                desc: "Métricas y objetivos", image: progressImage },
    ],
  },
  {
    title: "Sistema",
    items: [
      { to: "/app/admin/usuarios",           label: "Usuarios",                desc: "Ver usuarias y permisos", image: usersImage },
      { to: "/app/admin/invitaciones",       label: "Invitaciones",            desc: "Crear y revocar invitaciones", image: invitationsImage },
      { to: "/app/admin/configuracion",      label: "Ajustes generales",       desc: "Configuración y mantenimiento", image: settingsDeskImage },
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
      <BackButton fallbackTo="/app/perfil" className="text-sm muted inline-flex items-center gap-1 mb-2 hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>

      <header className="mb-5">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary mb-1">Esencia de Bienestar</p>
        <h1 className="heading-lg tracking-tight">Panel de administración</h1>
        <p className="muted text-sm mt-1">Tu centro de control, contenido y acompañamiento.</p>
      </header>

      <section className="challenge-premium rounded-[28px] overflow-hidden mb-7 relative text-white">
        <img src={welcomeImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/65 to-black/45" />
        <div className="relative p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/75">Bienvenida</div>
              <div className="font-serif text-2xl mt-1 text-white">Tu espacio de acompañamiento</div>
              <p className="text-xs text-white/70 mt-1">Cuida el contenido que acompaña a tu comunidad.</p>
            </div>
            <div className="h-11 w-11 rounded-2xl grid place-items-center text-2xl bg-white/20 border border-white/30 shadow-[0_10px_22px_-16px_rgba(0,0,0,0.45)]">✦</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              [stats.recipes, "Recetas"],
              [stats.users, "Usuarias"],
              [stats.pendingInvites, "Invitaciones"],
              [stats.activeChallenges, "Retos activos"],
            ].map(([value, label]) => (
              <div key={label as string} className="rounded-2xl bg-black/20 border border-white/15 backdrop-blur-sm p-2.5 shadow-[0_8px_18px_-16px_rgba(0,0,0,0.35)]">
                <div className="font-serif text-xl leading-none text-white">{value ?? "—"}</div>
                <div className="text-[10px] text-white/70 mt-1">{label}</div>
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
                  className="challenge-premium group relative overflow-hidden rounded-[22px] bg-white/90 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <img src={s.image} alt="" className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[15px] leading-tight text-foreground">{s.label}</div>
                    <div className="text-xs muted mt-1 truncate">{s.desc}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 muted shrink-0 group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
