import imgGuias from "@/assets/resources/guide-welcome-final.svg";
import imgSkincare from "@/assets/resources/guide-skincare-final.svg";
import imgMenopause from "@/assets/resources/guide-menopause-final.svg";
import imgProteinGuide from "@/assets/resources/guide-protein-final.svg";
import ResourceCategoryTile from "@/components/resources/ResourceCategoryTile";

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
  sort_order?: number | null;
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

const getStoredCategoryCover = (coverImage?: string | null) => {
  const value = String(coverImage ?? "").trim();
  return value.length > 0 ? value : null;
};

export const resolveCategoryCoverImage = (
  category: { cover_image?: string | null } | null | undefined,
  fallbackImage: string
) => {
  return getStoredCategoryCover(category?.cover_image) ?? fallbackImage;
};

export const cards: GuideCard[] = [
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
    image: imgSkincare,
  },
  {
    slug: "guia-menopausia",
    title: "Guía de menopausia",
    description: "Guías para acompañar esta etapa con bienestar y equilibrio.",
    image: imgMenopause,
  },
  {
    slug: "ebook-alimentos-ricos-en-proteina",
    title: "Ebook: Alimentos ricos en proteína",
    description: "Más de 300 alimentos organizados por categorías para ayudarte a elegir mejor cada día.",
    image: imgProteinGuide,
  },
];

export const cleanGuideTitle = (title: string, slug: string) => {
  if (slug === "ebook-alimentos-ricos-en-proteina") {
    return title.replace(/^eBook/i, "Ebook");
  }
  return title;
};

export const guideCardMatchesCategory = (
  category: { name?: string | null; slug?: string | null },
  card: Pick<GuideCard, "slug" | "title">
) => {
  const categorySlug = normalizeText(category.slug);
  const categoryName = normalizeText(category.name);
  const cardSlug = normalizeText(card.slug);
  const cardTitle = normalizeText(card.title);
  const value = `${categorySlug} ${categoryName}`;

  if (categorySlug === cardSlug || categoryName === cardTitle) return true;

  if (card.slug === "guia-bienvenida") {
    return value.includes("bienvenida");
  }

  if (card.slug === "guia-cuidado-piel") {
    return value.includes("piel") && (
      value.includes("cuidado") ||
      value.includes("facial") ||
      value.includes("skincare")
    );
  }

  if (card.slug === "guia-menopausia") {
    return value.includes("menopausia");
  }

  if (card.slug === "ebook-alimentos-ricos-en-proteina") {
    return value.includes("proteina") && (
      value.includes("ebook") ||
      value.includes("alimento") ||
      value.includes("ricos")
    );
  }

  return false;
};

const finalGuideCoverImages: Record<string, string> = {
  "guia-bienvenida": imgGuias,
  "guia-cuidado-piel": imgSkincare,
  "guia-menopausia": imgMenopause,
  "ebook-alimentos-ricos-en-proteina": imgProteinGuide,
};

export const resolveGuideCardCoverImage = (
  slug: string,
  fallbackImage: string,
  category?: { cover_image?: string | null } | null
) => {
  return getStoredCategoryCover(category?.cover_image) ?? finalGuideCoverImages[slug] ?? fallbackImage;
};

type ResolvedGuideCard = {
  card: GuideCard;
  category: GuideCategory | null;
  title: string;
  description: string;
  image: string;
  fallbackOrder: number;
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
    return categories.find(category => guideCardMatchesCategory(category, card)) ?? null;
  };

  const visibleCards = cards
    .map((card, fallbackOrder) => {
      const category = getCategoryForCard(card);
      const title = cleanGuideTitle(category?.name || card.title, card.slug);
      const description = category?.subtitle || card.description;
      const image = resolveGuideCardCoverImage(card.slug, card.image, category);
      return { card, category, title, description, image, fallbackOrder };
    })
    .filter(({ title, description }) => {
      if (!term) return true;
      return normalizeText(`${title} ${description}`).includes(term);
    })
    .sort((a, b) => {
      const orderA = a.category?.sort_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.category?.sort_order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB || a.fallbackOrder - b.fallbackOrder;
    });

  if (visibleCards.length === 0) {
    return <div className="card-soft p-6 text-center muted">No hay guías que coincidan.</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-5">
      {visibleCards.map(({ card, category, title, description, image }) => (
        <ResourceCategoryTile
          key={card.slug}
          image={image}
          title={title}
          subtitle={description}
          badge={card.slug === "ebook-alimentos-ricos-en-proteina" ? "PDF" : undefined}
          disabled={!category}
          onClick={() => category && onOpenCategory(category.id)}
        />
      ))}
    </div>
  );
}
