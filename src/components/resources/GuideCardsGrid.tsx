import proteinGuideCover from "@/assets/resources/guia-proteina-cover.jpg";
import imgGuias from "@/assets/resource-guias.png";
import imgMentalidad from "@/assets/resource-mentalidad.png";
import imgAlimentacion from "@/assets/resource-alimentacion.png";

type GuideCard = {
  slug: string;
  title: string;
  description: string;
  image: string;
};

type GuideCategory = {
  id: string;
  name: string;
  slug: string | null;
  subtitle?: string | null;
  cover_image?: string | null;
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
    title: "Ebook: Alimentos ricos en proteína",
    description: "Más de 300 alimentos organizados por categorías para ayudarte a elegir mejor cada día.",
    image: proteinGuideCover,
  },
];

const cleanGuideTitle = (title: string, slug: string) => {
  if (slug === "ebook-alimentos-ricos-en-proteina") {
    return title.replace(/^eBook/i, "Ebook");
  }
  return title;
};

export default function GuideCardsGrid({
  categories,
  query = "",
  onOpenCategory,
}: {
  categories: GuideCategory[];
  query?: string;
  onOpenCategory: (categoryId: string) => void;
}) {
  const term = normalizeText(query);
  const getCategoryForCard = (card: GuideCard) => {
    const cardSlug = normalizeText(card.slug);
    const cardTitle = normalizeText(card.title);
    return categories.find(category => {
      const slug = normalizeText(category.slug);
      const name = normalizeText(category.name);
      return slug === cardSlug || name === cardTitle;
    }) ?? null;
  };

  const visibleCards = cards
    .map((card) => {
      const category = getCategoryForCard(card);
      const title = cleanGuideTitle(category?.name || card.title, card.slug);
      const description = category?.subtitle || card.description;
      const image = category?.cover_image || card.image;
      return { card, category, title, description, image };
    })
    .filter(({ title, description }) => {
      if (!term) return true;
      return normalizeText(`${title} ${description}`).includes(term);
    });

  if (visibleCards.length === 0) {
    return <div className="card-soft p-6 text-center muted">No hay guías que coincidan.</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
      {visibleCards.map(({ card, category, title, description, image }) => {
        const disabled = !category;
        return (
          <button
            key={card.slug}
            type="button"
            onClick={() => category && onOpenCategory(category.id)}
            disabled={disabled}
            className={`wellness-tile app-category-card group overflow-hidden rounded-[28px] p-0 text-center transition-all duration-300 ${
              disabled ? "cursor-default opacity-60" : "hover:-translate-y-1"
            }`}
          >
            <div className="app-photo-cover-frame w-full overflow-hidden bg-black">
              <img
                src={image}
                alt=""
                className="app-photo-cover-image transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            <div className="flex min-h-[104px] flex-col items-center justify-center px-3 py-3.5">
              <h2 className="font-sans text-base font-bold leading-tight text-foreground">{title}</h2>
              <p className="mt-1.5 text-[10.5px] tracking-wide text-muted-foreground">{description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
