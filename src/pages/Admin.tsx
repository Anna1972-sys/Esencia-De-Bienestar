import { Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, RotateCcw, Save } from "lucide-react";
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
import invitationsAdminImage from "@/assets/home-recipe-generator.png";
import challengesImage from "@/assets/home-retos.png";
import shoppingImage from "@/assets/challenge-shopping.png";
import diaryImage from "@/assets/diary/diary-hero.png";
import progressImage from "@/assets/home-progreso.png";
import welcomeImage from "@/assets/home-admin.png";
import settingsDeskImage from "@/assets/challenge-downloads.png";

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
    ],
  },
  {
    title: "Sistema",
    items: [
      { key: "usuarios", to: "/app/admin/usuarios",           label: "Usuarios",                desc: "Ver usuarias y permisos", image: usersAdminImage },
      { key: "invitaciones", to: "/app/admin/invitaciones",       label: "Invitaciones",            desc: "Crear y revocar invitaciones", image: invitationsAdminImage },
      { key: "configuracion", to: "/app/admin/configuracion",      label: "Ajustes generales",       desc: "Configuración y mantenimiento", image: settingsDeskImage },
    ],
  },
];

const DEFAULT_ADMIN_CARD_ORDER = groups.flatMap(group => group.items.map(item => item.key));

type Stats = {
  recipes: number | null;
  users: number | null;
  pendingInvites: number | null;
  activeChallenges: number | null;
};

export default function Admin() {
  const [stats, setStats] = useState<Stats>({ recipes: null, users: null, pendingInvites: null, activeChallenges: null });
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_ADMIN_CARD_ORDER);
  const [orderingCards, setOrderingCards] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

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

  useEffect(() => {
    loadCardOrder("admin_card_order", DEFAULT_ADMIN_CARD_ORDER, supabase as any).then(setCardOrder);
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
      <BackButton fallbackTo="/app/perfil" className="text-sm muted inline-flex items-center gap-1 mb-2 hover:text-foreground transition-colors">
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
  return <Link to={item.to} className={className}>{content}</Link>;
}
