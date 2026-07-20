import { BookOpen, FileText } from "lucide-react";
import proteinGuideCover from "@/assets/resources/guia-proteina-cover.jpg";
import imgGuias from "@/assets/resource-guias.png";
import imgImprescindibles from "@/assets/resource-imprescindibles.png";
import imgMentalidad from "@/assets/resource-mentalidad.png";
import imgEducacion from "@/assets/resource-educacion.png";
import imgAlimentacion from "@/assets/resource-alimentacion.png";

type GuideCard = {
  key: string;
  title: string;
  description: string;
  image: string;
  badge?: string;
  comingSoon?: boolean;
  match?: (resource: any) => boolean;
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

const getPdfUrl = (resource: any) => {
  const blocks = Array.isArray(resource?.blocks) ? resource.blocks : [];
  const pdfBlock = blocks.find((block: any) => block?.type === "pdf" && block?.url);
  if (pdfBlock?.url) return String(pdfBlock.url);

  const url = String(resource?.url ?? "");
  if (url.toLowerCase().includes(".pdf")) return url;

  return "";
};

const cards: GuideCard[] = [
  {
    key: "proteina",
    title: "Alimentos ricos en proteína",
    description: "Más de 300 alimentos organizados por categorías para ayudarte a elegir mejor cada día.",
    image: proteinGuideCover,
    badge: "NUEVA",
    match: (resource) => {
      const value = normalizeText(resource?.title);
      return value.includes("proteina") || value.includes("alimentos ricos");
    },
  },
  {
    key: "bienvenida",
    title: "Guía de bienvenida",
    description: "Descubre cómo aprovechar todas las funciones de Esencia de Bienestar.",
    image: imgGuias,
    match: (resource) => normalizeText(resource?.title).includes("bienvenida"),
  },
  {
    key: "piel",
    title: "Cuidado de la piel",
    description: "Recursos para cuidar tu piel con una rutina sencilla y constante.",
    image: imgImprescindibles,
    comingSoon: true,
  },
  {
    key: "menopausia",
    title: "Menopausia",
    description: "Guías para acompañar esta etapa con bienestar y equilibrio.",
    image: imgMentalidad,
    comingSoon: true,
  },
  {
    key: "deportiva",
    title: "Nutrición deportiva",
    description: "Recursos para adaptar tu nutrición a tus entrenamientos.",
    image: imgAlimentacion,
    comingSoon: true,
  },
  {
    key: "etiquetas",
    title: "Lectura de etiquetas",
    description: "Aprende a interpretar etiquetas para elegir con más claridad.",
    image: imgEducacion,
    comingSoon: true,
  },
];

export default function GuideCardsGrid({
  resources,
  query = "",
}: {
  resources: any[];
  query?: string;
}) {
  const term = normalizeText(query);
  const visibleCards = cards.filter((card) => {
    if (!term) return true;
    return normalizeText(`${card.title} ${card.description}`).includes(term);
  });

  const openGuide = (card: GuideCard) => {
    if (card.comingSoon) return;

    const resource = card.match ? resources.find(card.match) : null;
    const pdfUrl = getPdfUrl(resource);

    if (pdfUrl) {
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (resource?.id) {
      window.location.href = `/app/recursos/${resource.id}`;
    }
  };

  if (visibleCards.length === 0) {
    return <div className="card-soft p-6 text-center muted">No hay guías que coincidan.</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {visibleCards.map((card) => {
        const disabled = card.comingSoon;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => openGuide(card)}
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
                    Próximamente
                  </span>
                ) : (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    Guía completa
                  </span>
                )}
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  {disabled ? <BookOpen className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
