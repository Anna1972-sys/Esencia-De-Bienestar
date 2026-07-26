import { Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, BellRing, ChevronRight, Heart, RotateCcw, Save, UserX, Utensils } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadCardOrder, moveCardKey, orderCards, saveCardOrder } from "@/lib/cardOrderSettings";
import { toast } from "sonner";
import recipesImage from "@/assets/home-recetas.png";
import userRecipesImage from "@/assets/cat-comidas.jpg";
import videosImage from "@/assets/challenge-videos.png";
import movementImage from "@/assets/home-movimiento.png";
import nutritionImage from "@/assets/nutrition/home-tortitas-h24.png";
import macroSpecialistImage from "@/assets/admin-macro-specialist-clean.jpg";
import internalFoodsImage from "@/assets/resource-alimentacion.png";
import productsImage from "@/assets/home-productos-te-jardin.png";
import usersAdminImage from "@/assets/home-admin.png";
import invitationsAdminImage from "@/assets/admin-invitations-card.jpg";
import challengesImage from "@/assets/home-retos.png";
import shoppingImage from "@/assets/challenge-shopping.png";
import diaryImage from "@/assets/diary/diary-hero.png";
import progressImage from "@/assets/home-progreso.png";
import welcomeImage from "@/assets/home-admin.png";
import settingsDeskImage from "@/assets/challenge-downloads.png";
import favoritesImage from "@/assets/admin-favorites.jpg";

type Item = {
  key: string;
  to: string;
  label: string;
  desc: string;
  image: string;
  imageClass?: string;
};

const groups: { title: string; items: Item[] }[] = [
  {
    title: "Contenido",
    items: [
      { key: "recetas", to: "/app/admin/recetas",            label: "Recetas",                 desc: "Crear y editar recetas", image: recipesImage },
      { key: "recetas-usuarias", to: "/app/admin/recetas-usuarias",   label: "Recetas generadas por usuarios",     desc: "Revisar recetas creadas con IA", image: userRecipesImage },
      { key: "especialista-macros", to: "/app/admin/especialista-macros", label: "Especialista en Macros", desc: "Probar cálculos nutricionales", image: macroSpecialistImage },
      { key: "alimentos-internos", to: "/app/admin/alimentos-internos", label: "Alimentos internos", desc: "Base nutricional editable", image: internalFoodsImage },
      { key: "productos", to: "/app/admin/productos",          label: "Salud y Bienestar",      desc: "Todo sobre Herbalife", image: productsImage },
      
      { key: "recursos", to: "/app/admin/recursos",           label: "Vídeos y guías",          desc: "Contenido en vídeo", image: videosImage },
      { key: "movimiento", to: "/app/admin/movimiento",         label: "Movimiento y ejercicio",  desc: "Entrenamientos y rutinas", image: movementImage },
      { key: "nutricion", to: "/app/admin/nutricion",          label: "Nutrición deportiva",     desc: "Alimentación y batidos", image: nutritionImage, imageClass: "admin-card-image-bright" },
      { key: "retos", to: "/app/admin/retos",              label: "Retos de 5 días",         desc: "Crear y editar retos", image: challengesImage },
    ],
  },
  {
    title: "Herramientas",
    items: [
      { key: "lista-compra", to: "/app/admin/lista-compra",       label: "Lista de compra",         desc: "Productos y categorías", image: shoppingImage },
      { key: "diario", to: "/app/admin/diario",             label: "Diario",                  desc: "Preguntas del diario", image: diaryImage },
      { key: "progreso", to: "/app/admin/progreso",           label: "Progreso",                desc: "Métricas y objetivos", image: progressImage },
      { key: "favoritos", to: "/app/admin/favoritos",         label: "Favoritos",               desc: "Contenido más guardado y utilizado", image: favoritesImage },
    ],
  },
  {
    title: "Sistema",
    items: [
      { key: "usuarios", to: "/app/admin/usuarios",           label: "Usuarios",                desc: "Ver usuarias y permisos", image: usersAdminImage },
      { key: "invitaciones", to: "/app/admin/invitaciones",       label: "Invitaciones",            desc: "Crear y revocar invitaciones", image: invitationsAdminImage },
      { key: "configuracion", to: "/app/admin/configuracion",      label: "Ajustes generales",       desc: "Configuración y mantenimiento", image: settingsDeskImage },
      { key: "errores", to: "/app/admin/errores",                 label: "Control de errores",       desc: "Avisos recientes de la aplicación", image: settingsDeskImage },
    ],
  },
];

const DEFAULT_ADMIN_CARD_ORDER = groups.flatMap(group => group.items.map(item => item.key));
const ADMIN_SCROLL_POSITION_KEY = "esencia:admin-dashboard-scroll";

type Stats = {
  recipes: number | null;
  users: number | null;
  pendingInvites: number | null;
  activeChallenges: number | null;
};
type AdminSummary = {
  clientsNeedingAttention: number | null;
  pendingReminders: number | null;
  mostSaved: { title: string; count: number } | null;
  latestRecipes: Array<{ id: string; title: string }>;
};

export default function Admin() {
  const [stats, setStats] = useState<Stats>({ recipes: null, users: null, pendingInvites: null, activeChallenges: null });
  const [summary, setSummary] = useState<AdminSummary>({
    clientsNeedingAttention: null,
    pendingReminders: null,
    mostSaved: null,
    latestRecipes: [],
  });
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_ADMIN_CARD_ORDER);
  const [orderingCards, setOrderingCards] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    (async () => {
      const [r, u, i, c, profilesResult, rolesResult, activityResult, remindersResult, favoritesResult, latestRecipesResult] = await Promise.all([
        (supabase as any).from("recipes").select("id", { count: "exact", head: true }),
        (supabase as any).from("profiles").select("id", { count: "exact", head: true }),
        (supabase as any).from("invitations").select("id", { count: "exact", head: true }).eq("status", "pending"),
        (supabase as any).from("challenges").select("id", { count: "exact", head: true }),
        (supabase as any).from("profiles").select("id"),
        (supabase as any).from("user_roles").select("user_id,role"),
        (supabase as any).from("user_activity_sessions").select("user_id,last_seen_at").order("last_seen_at", { ascending: false }).limit(5000),
        (supabase as any).from("follow_up_reminders").select("id", { count: "exact", head: true }).is("completed_at", null),
        (supabase as any).rpc("get_favorite_content_stats"),
        (supabase as any).from("recipes").select("id,title").order("created_at", { ascending: false }).limit(3),
      ]);
      setStats({
        recipes: r.count ?? 0,
        users: u.count ?? 0,
        pendingInvites: i.count ?? 0,
        activeChallenges: c.count ?? 0,
      });
      const adminIds = new Set((rolesResult.data ?? []).filter((role: any) => role.role === "admin").map((role: any) => role.user_id));
      const latestActivity = new Map<string, string>();
      (activityResult.data ?? []).forEach((row: any) => {
        if (row.user_id && !latestActivity.has(row.user_id)) latestActivity.set(row.user_id, row.last_seen_at);
      });
      const now = Date.now();
      const attentionCount = (profilesResult.data ?? []).filter((client: any) => {
        if (adminIds.has(client.id)) return false;
        const lastSeen = latestActivity.get(client.id);
        return !lastSeen || now - +new Date(lastSeen) >= 7 * 24 * 60 * 60 * 1000;
      }).length;
      const favoriteRows = [...(favoritesResult.data ?? [])].sort((a: any, b: any) => Number(b.saved_count) - Number(a.saved_count));
      setSummary({
        clientsNeedingAttention: profilesResult.error || rolesResult.error ? null : attentionCount,
        pendingReminders: remindersResult.error ? null : remindersResult.count ?? 0,
        mostSaved: favoriteRows[0]
          ? { title: favoriteRows[0].title || "Contenido", count: Number(favoriteRows[0].saved_count || 0) }
          : null,
        latestRecipes: (latestRecipesResult.data ?? []).map((recipe: any) => ({ id: recipe.id, title: recipe.title || "Receta sin título" })),
      });
    })();
  }, []);

  useEffect(() => {
    loadCardOrder("admin_card_order", DEFAULT_ADMIN_CARD_ORDER, supabase as any).then(setCardOrder);
  }, []);

  useEffect(() => {
    const savedPosition = Number(window.sessionStorage.getItem(ADMIN_SCROLL_POSITION_KEY) ?? 0);
    const restore = () => {
      if (savedPosition > 0) window.scrollTo({ top: savedPosition });
    };
    const frame = requestAnimationFrame(restore);
    const timer = window.setTimeout(restore, 250);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  const orderedItemsForGroup = (items: Item[]) => orderCards(items, cardOrder);

  const currentAdminOrder = () => groups.flatMap(group => orderedItemsForGroup(group.items).map(item => item.key));

  const moveAdminCard = (groupTitle: string, key: string, direction: -1 | 1) => {
    setCardOrder(previousOrder => groups.flatMap(group => {
      const groupItems = orderCards(group.items, previousOrder);
      const groupKeys = groupItems.map(item => item.key);
      return group.title === groupTitle ? moveCardKey(groupKeys, key, direction) : groupKeys;
    }));
  };

  const saveAdminOrder = async () => {
    setSavingOrder(true);
    const nextOrder = currentAdminOrder();
    const result = await saveCardOrder("admin_card_order", nextOrder, supabase as any);
    setCardOrder(result.order);
    setSavingOrder(false);
    if (result.savedRemotely) toast.success("Orden del panel de administración guardado");
    else toast.warning("Orden guardado en este navegador. Falta aplicar la migración para guardarlo globalmente.");
  };

  const resetAdminOrder = () => {
    setCardOrder(DEFAULT_ADMIN_CARD_ORDER);
    toast.info("Orden restaurado. Pulsa Guardar orden para conservarlo.");
  };

  return (
    <div className="admin-dashboard pb-28 max-w-3xl mx-auto">
      <BackButton fallbackTo="/app" forceFallback className="text-sm muted inline-flex items-center gap-1 mb-2 hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>

      <header className="mb-5">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary mb-1">Esencia de Bienestar</p>
        <h1 className="heading-lg tracking-tight">Panel de administración</h1>
        <div className="flex items-start justify-between gap-3 mt-1">
          <p className="muted text-sm">Tu centro de control, contenido y acompañamiento.</p>
          <button type="button" className="btn-secondary compact shrink-0" onClick={() => setOrderingCards(value => !value)}>
            {orderingCards ? "Terminar" : "Ordenar"}
          </button>
        </div>
      </header>

      <section className="challenge-premium admin-hero rounded-[28px] overflow-hidden mb-7 relative text-white">
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

      <section className="card-soft p-4 mb-7" aria-label="Resumen de hoy">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-serif text-base" style={{ color: "hsl(var(--plum))" }}>Resumen de hoy</h2>
            <p className="text-[11px] muted mt-0.5">Lo más importante de un vistazo.</p>
          </div>
          <span className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-1">Solo administración</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/app/admin/usuarios#alertas-seguimiento" className="rounded-2xl bg-rose-50 p-3 text-rose-700">
            <UserX className="h-4 w-4 mb-2" />
            <div className="font-serif text-xl leading-none">{summary.clientsNeedingAttention ?? "—"}</div>
            <div className="text-[10px] mt-1">Clientas que necesitan atención</div>
          </Link>
          <Link to="/app/admin/usuarios#alertas-avanzadas" className="rounded-2xl bg-amber-50 p-3 text-amber-700">
            <BellRing className="h-4 w-4 mb-2" />
            <div className="font-serif text-xl leading-none">{summary.pendingReminders ?? "—"}</div>
            <div className="text-[10px] mt-1">Recordatorios pendientes</div>
          </Link>
          <Link to="/app/admin/favoritos" className="rounded-2xl bg-pink-50 p-3 text-pink-700">
            <Heart className="h-4 w-4 mb-2 fill-current" />
            <div className="font-medium text-xs leading-tight line-clamp-2">{summary.mostSaved?.title ?? "Sin favoritos todavía"}</div>
            <div className="text-[10px] mt-1">{summary.mostSaved ? `${summary.mostSaved.count} guardados` : "Contenido más guardado"}</div>
          </Link>
          <Link to="/app/admin/recetas" className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <Utensils className="h-4 w-4 mb-2" />
            <div className="space-y-1">
              {summary.latestRecipes.length ? summary.latestRecipes.map(recipe => (
                <div key={recipe.id} className="text-[10px] truncate">{recipe.title}</div>
              )) : <div className="text-xs">Sin recetas recientes</div>}
            </div>
            <div className="text-[10px] mt-1 opacity-75">Últimas recetas creadas</div>
          </Link>
        </div>
      </section>

      {orderingCards && (
        <div className="card-soft p-3 mb-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="muted flex-1 min-w-[180px]">Usa las flechas de cada tarjeta y guarda el orden.</span>
          <button type="button" className="btn-secondary compact" onClick={resetAdminOrder}>
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar
          </button>
          <button type="button" className="btn-primary compact" onClick={saveAdminOrder} disabled={savingOrder}>
            <Save className="h-3.5 w-3.5" /> {savingOrder ? "Guardando…" : "Guardar orden"}
          </button>
        </div>
      )}

      <div className="space-y-8">
        {groups.map((g) => {
          const groupItems = orderedItemsForGroup(g.items);
          return (
            <section key={g.title}>
              <div className="flex items-center gap-3 mb-3 px-1"><div className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" /><div className="text-[11px] font-bold muted uppercase tracking-[0.16em]">{g.title}</div><div className="h-px flex-1 bg-gradient-to-l from-primary/40 to-transparent" /></div>
              <div className="grid grid-cols-2 gap-5">
                {groupItems.map((s, index) => (
                  <AdminCard
                    key={s.key}
                    item={s}
                    ordering={orderingCards}
                    orderControls={orderingCards ? (
                      <div className="absolute right-2 top-2 z-10 flex gap-1">
                        <button type="button" className="h-8 w-8 rounded-full bg-white/95 border border-primary/30 text-primary grid place-items-center disabled:opacity-35" disabled={index === 0} onClick={() => moveAdminCard(g.title, s.key, -1)} aria-label={`Subir ${s.label}`}>
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" className="h-8 w-8 rounded-full bg-white/95 border border-primary/30 text-primary grid place-items-center disabled:opacity-35" disabled={index === groupItems.length - 1} onClick={() => moveAdminCard(g.title, s.key, 1)} aria-label={`Bajar ${s.label}`}>
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AdminCard({ item, ordering, orderControls }: { item: Item; ordering: boolean; orderControls?: ReactNode }) {
  const className = `challenge-premium admin-card group relative overflow-hidden rounded-[28px] transition-all duration-300 ${ordering ? "cursor-default ring-2 ring-primary/20" : "hover:-translate-y-1"} ${item.to === "/app/admin/nutricion" ? "admin-card-sport-nutrition" : ""}`;
  const content = (
    <>
      {orderControls}
      <div className="admin-card-image-wrap">
        <div className="admin-card-image-frame">
          <img
            src={item.image}
            alt=""
            className={`admin-card-image transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-2 ${item.imageClass ?? ""}`}
          />
        </div>
      </div>
      <div className="admin-card-body flex items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[15px] leading-tight text-foreground">{item.label}</div>
          <div className="text-xs muted mt-1 truncate">{item.desc}</div>
        </div>
        <ChevronRight className="h-4 w-4 muted shrink-0 group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
      </div>
    </>
  );

  if (ordering) return <div className={className}>{content}</div>;
  return (
    <Link
      to={item.to}
      className={className}
      onClick={() => window.sessionStorage.setItem(ADMIN_SCROLL_POSITION_KEY, String(window.scrollY))}
    >
      {content}
    </Link>
  );
}
