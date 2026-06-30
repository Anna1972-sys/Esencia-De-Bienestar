import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import BackButton from "@/components/BackButton";
import recipesImage from "@/assets/home-recetas.png";
import userRecipesImage from "@/assets/cat-comidas.jpg";
import videosImage from "@/assets/challenge-videos.png";
import nutritionImage from "@/assets/nutrition/home-tortitas-h24.png";
import macroSpecialistImage from "@/assets/admin-macro-specialist-clean.jpg";
import internalFoodsImage from "@/assets/resource-alimentacion.png";
import productsImage from "@/assets/home-productos-te-jardin.png";
import usersAdminImage from "@/assets/home-admin.png";
import invitationsAdminImage from "@/assets/home-recipe-generator.png";
import challengesImage from "@/assets/home-retos.png";
import diaryImage from "@/assets/diary/diary-hero.png";
import progressImage from "@/assets/home-progreso.png";
import settingsDeskImage from "@/assets/challenge-downloads.png";

type Props = {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
};

const adminCoverImages: Array<{ match: string; image: string; key: string }> = [
  { match: "/app/admin/recetas-usuarias", image: userRecipesImage, key: "user-recipes" },
  { match: "/app/admin/especialista-macros", image: macroSpecialistImage, key: "macro" },
  { match: "/app/admin/alimentos-internos", image: internalFoodsImage, key: "internal-foods" },
  { match: "/app/admin/productos", image: productsImage, key: "products" },
  { match: "/app/admin/recursos", image: videosImage, key: "resources" },
  { match: "/app/admin/nutricion", image: nutritionImage, key: "nutrition" },
  { match: "/app/admin/retos", image: challengesImage, key: "challenges" },
  { match: "/app/admin/diario", image: diaryImage, key: "diary" },
  { match: "/app/admin/progreso", image: progressImage, key: "progress" },
  { match: "/app/admin/usuarios", image: usersAdminImage, key: "users" },
  { match: "/app/admin/seguimiento", image: usersAdminImage, key: "users" },
  { match: "/app/admin/invitaciones", image: invitationsAdminImage, key: "invites" },
  { match: "/app/admin/configuracion", image: settingsDeskImage, key: "settings" },
  { match: "/app/admin/recetas", image: recipesImage, key: "recipes" },
];

export default function AdminPageHeader({
  title,
  subtitle,
  backTo = "/app/admin",
  backLabel = "Volver",
  actions,
}: Props) {
  const { pathname } = useLocation();
  const cover = pathname === "/app/admin/movimiento"
    ? null
    : adminCoverImages.find(item => pathname === item.match || pathname.startsWith(`${item.match}/`)) ?? null;

  return (
    <div className="mb-6">
      <BackButton
        fallbackTo={backTo}
        className="text-sm muted inline-flex items-center gap-1 mb-3 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> {backLabel}
      </BackButton>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="heading-lg tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="muted text-sm mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {cover && (
        <section className={`admin-section-cover-card admin-section-cover-${cover.key} mt-4 overflow-hidden rounded-[26px] border border-[#FF2D95] bg-[#FFF7FA]`}>
          <img src={cover.image} alt="" className="h-full w-full object-cover" />
        </section>
      )}
    </div>
  );
}
