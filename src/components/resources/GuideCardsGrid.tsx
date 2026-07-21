import { FileText } from "lucide-react";
import proteinGuideCover from "@/assets/resources/guia-proteina-cover.jpg";
import imgGuias from "@/assets/resource-guias.png";
import imgMentalidad from "@/assets/resource-mentalidad.png";
import imgAlimentacion from "@/assets/resource-alimentacion.png";

type GuideCard = {
  slug: string;
  title: string;
  description: string;
  image: string;
  badge?: string;
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const isGuidesCategory = (category?: { name?: string | null; slug?: string | null } | null) => {
  const value = normalizeText(`${category?.slug ?? ""} ${category?.name ?? ""}`);
  return value.includes("guia") || value.includes("recurso");
};

const cards: GuideCard[] = [
  {
    slug: "guia-bienvenida",
    title: "Guía de bienvenida",
    description: "Descubre cómo aprovechar todas las funciones de Esencia de Bienestar.",
    image: imgGuias,
  },
  {
    slug: "guia-cuidado-piel",
    title: "Guía de cuidado de la piel",
    description: "Recursos para cuidar tu piel con una rutina sencilla y constante.",
    image: imgAlimentacion,
  },
  {
    slug: "guia-menopausia",
    title: "Guía de menopausia",
    description: "Guías para acompañar esta etapa con bienestar y equilibrio.",
    image: imgMentalidad,
  },
  {
    slug: "ebook-alimentos-ricos-en-proteina",
    title: "eBook: Alimentos ricos en proteína",
    description: "Más de 300 alimentos organizados por categorías para ayudarte a elegir mejor cada día.",
    image: proteinGuideCover,
    badge: "NUEVA",
  },
];

export default function GuideCardsGrid({
  categories,
  query = "",
  onOpenCategory,
}: {
  categories: { id: string; name: string; slug: string | null }[];
  query?: string;
  onOpenCategory: (categoryId: string) => void;
}) {
  const term = normalizeText(query);
  const visibleCards = cards.filter((card) => {
    if (!term) return true;
    return normalizeText(`${card.title} ${card.description}`).includes(term);
  });

  const getCategoryForCard = (card: GuideCard) => {
    const cardSlug = normalizeText(card.slug);
    const cardTitle = normalizeText(card.title);
    return categories.find(category => {
      const slug = normalizeText(category.slug);
      const name = normalizeText(category.name);
      return slug === cardSlug || name === cardTitle;
    }) ?? null;
  };

  if (visibleCards.length === 0) {
    return <div className="card-soft p-6 text-center muted">No hay guías que coincidan.</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {visibleCards.map((card) => {
        const category = getCategoryForCard(card);
        const disabled = !category;
        return (
          <button
            key={card.slug}
            type="button"
            onClick={() => category && onOpenCategory(category.id)}
            disabled={disabled}
            className={`wellness-tile group relative overflow-hidden rounded-[24px] p-0 text-left transition-all duration-300 ${
              disabled ? "cursor-default" : "hover:-translate-y-1 hover:shadow-glow"
            }`}
          >
            <div className="relative h-32 w-full overflow-hidden bg-muted sm:h-36">
              <img
                src={card.image}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {card.badge && (
                <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  {card.badge}
                </span>
              )}
            </div>

            <div className="flex min-h-[150px] flex-col p-3.5">
              <h2 className="font-sans text-base font-bold leading-tight text-foreground">{card.title}</h2>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{card.description}</p>

              <div className="mt-3 flex items-center justify-between gap-2">
                {disabled ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    Sin publicaciones
                  </span>
                ) : (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    Ver categoría
                  </span>
                )}
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
