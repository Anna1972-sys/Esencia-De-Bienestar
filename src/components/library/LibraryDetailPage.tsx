import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileText, ExternalLink, Image as ImageIcon, MousePointerClick, Video } from "lucide-react";
import type { ContentBlock } from "@/lib/movementCategories";
import type { LibraryCategory } from "./LibraryPage";
import BackButton from "@/components/BackButton";
import { mediaUrl } from "@/lib/mediaStorage";

function isEmbeddable(url: string) {
  return /youtube\.com|youtu\.be|vimeo\.com/.test(url);
}
function toEmbed(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

type Props = {
  table: string;
  basePath: string;
  categories: readonly LibraryCategory[];
  visibleOnly?: boolean;
};

export default function LibraryDetailPage({ table, basePath, categories, visibleOnly = false }: Props) {
  const { id } = useParams();
  const [it, setIt] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [openNutritionSections, setOpenNutritionSections] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!id) return;
    (supabase as any)
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }: any) => {
        setIt(visibleOnly && data?.visible === false ? null : data);
        setLoading(false);
      });
  }, [id, table, visibleOnly]);

  if (loading) return <div className="muted">Cargando…</div>;
  if (!it)
    return (
      <div>
        <BackButton fallbackTo={basePath} className="text-sm muted inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="h-4 w-4" /> Volver
        </BackButton>
        <div className="card-soft p-6 text-center muted">Publicación no encontrada.</div>
      </div>
    );

  const cat = categories.find((c) => c.key === it.category || String((c as any).id ?? "") === String(it.category_id ?? ""));
  const blocks: ContentBlock[] = Array.isArray(it.blocks) ? it.blocks : [];
  const coverImage = it.cover_image || it.cover_image_url || it.image_url || "";
  const seenNutritionMedia = new Set<string>();
  const mediaKey = (url?: string | null) => {
    if (!url) return "";
    return mediaUrl(url).split("?")[0];
  };
  if (table === "nutrition_items" && coverImage) {
    seenNutritionMedia.add(mediaKey(coverImage));
  }
  const keepNutritionMedia = (url?: string | null) => {
    const key = mediaKey(url);
    if (!key) return true;
    if (seenNutritionMedia.has(key)) return false;
    seenNutritionMedia.add(key);
    return true;
  };
  const nutritionBlocks = table === "nutrition_items"
    ? blocks
        .map((block: any) => {
          if (["image", "video", "pdf"].includes(block?.type) && block.url) {
            return keepNutritionMedia(block.url) ? block : null;
          }
          if (block?.type === "section") {
            const next = { ...block };
            if (next.image_url && !keepNutritionMedia(next.image_url)) next.image_url = "";
            if (next.video_url && !keepNutritionMedia(next.video_url)) next.video_url = "";
            if (next.pdf_url && !keepNutritionMedia(next.pdf_url)) next.pdf_url = "";
            const hasContent = next.title || next.text || next.image_url || next.video_url || next.pdf_url || next.external_url;
            return hasContent ? next : null;
          }
          return block;
        })
        .filter(Boolean) as ContentBlock[]
    : blocks;
  const attachmentBlocks = blocks.filter((b: any) =>
    ["image", "video", "pdf", "link", "button"].includes(b?.type) && (b.url || b.label)
  );
  const textBlocks = blocks.filter((b: any) => !["image", "video", "pdf", "link", "button"].includes(b?.type));
  const orderedBlocks = table === "nutrition_items"
    ? nutritionBlocks
    : textBlocks;
  const description = it.description || it.subtitle || "";
  const title = it.title || it.name || it.label || it.subtitle || "Contenido";

  const resourceHref = (b: any) => {
    if (!b?.url) return "#";
    return b.type === "image" || b.type === "video" || b.type === "pdf" ? mediaUrl(b.url) : b.url;
  };

  const resourceLabel = (b: any) => {
    if (b.type === "pdf") return b.name || "Ver PDF";
    if (b.type === "video") return b.label || "Ver vídeo";
    if (b.type === "image") return b.caption || b.label || "Ver imagen";
    if (b.type === "link" || b.type === "button") return b.label || "Abrir enlace";
    return "Abrir recurso";
  };

  const resourceIcon = (type: string) => {
    if (type === "pdf") return <FileText className="h-4 w-4" />;
    if (type === "video") return <Video className="h-4 w-4" />;
    if (type === "image") return <ImageIcon className="h-4 w-4" />;
    return <ExternalLink className="h-4 w-4" />;
  };

  const renderBlock = (b: any, i: number, insideAccordion = false) => {
    if (b.type === "title") return <h2 key={i} className="heading-md mt-2">{b.value}</h2>;
    if (b.type === "subtitle") return <h3 key={i} className="font-serif text-lg" style={{ color: "hsl(var(--plum))" }}>{b.value}</h3>;
    if (b.type === "text")
      return (
        <p key={i} className="whitespace-pre-wrap leading-relaxed">
          {b.value}
        </p>
      );
    if (b.type === "nutrition_label") {
      const data = b.data && typeof b.data === "object" ? b.data : {};
      const values = [
        ["Kcal", data.calories ?? data.serving_calories],
        ["Proteínas", data.protein ?? data.serving_protein, "g"],
        ["Hidratos", data.carbs ?? data.serving_carbs, "g"],
        ["Grasas", data.fat ?? data.serving_fat, "g"],
        ["Fibra", data.fiber ?? data.serving_fiber, "g"],
      ].filter(([, value]) => value !== null && value !== undefined && value !== "");
      return (
        <section key={i} className="card-soft p-4 space-y-3">
          {!insideAccordion && <h2 className="font-serif text-xl">Información nutricional</h2>}
          {data.serving_size && <p className="text-sm muted">Por {String(data.serving_size)}</p>}
          {values.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {values.map(([label, value, unit]) => (
                <div key={String(label)} className="rounded-xl bg-secondary/70 p-3 text-center">
                  <div className="font-semibold">{String(value)}{unit || ""}</div>
                  <div className="text-xs muted">{String(label)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }
    if (b.type === "official_label") {
      if (!b.url) return null;
      return (
        <a key={i} href={mediaUrl(b.url)} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-center">
          <FileText className="h-4 w-4" /> Ver etiqueta oficial
        </a>
      );
    }
    if (b.type === "official_spoon") {
      if (!b.url) return null;
      const spoonUrl = String(b.url);
      return (
        <div key={i}>
          <div className="mb-3 rounded-2xl border border-primary bg-white/90 p-3 text-sm font-medium text-foreground flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-primary shrink-0" />
            <span>Pulsa aquí para comprobar la medida de la cuchara oficial.</span>
          </div>
          <a href={mediaUrl(spoonUrl)} target="_blank" rel="noreferrer" className="block">
            {spoonUrl.toLowerCase().split("?")[0].endsWith(".pdf") ? (
              <span className="btn-secondary w-full justify-center">
                <FileText className="h-4 w-4" /> Abrir documento de la cuchara oficial
              </span>
            ) : (
              <img src={mediaUrl(spoonUrl)} alt="Equivalencia cuchara Herbalife" className="w-full max-h-[60vh] object-contain rounded-2xl" />
            )}
          </a>
        </div>
      );
    }
    if (b.type === "image")
      return (
        <figure key={i}>
          <img src={mediaUrl(b.url)} alt={b.caption ?? ""} className="w-full rounded-xl" />
          {b.caption && <figcaption className="text-xs muted text-center mt-1">{b.caption}</figcaption>}
        </figure>
      );
    if (b.type === "video") {
      if (!b.url) return null;
      return (
        <figure key={i}>
          {isEmbeddable(b.url) ? (
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
              <iframe src={toEmbed(b.url)} className="w-full h-full" allowFullScreen />
            </div>
          ) : (
            <video src={mediaUrl(b.url)} controls className="w-full rounded-xl" />
          )}
          {b.caption && <figcaption className="text-xs muted text-center mt-1">{b.caption}</figcaption>}
        </figure>
      );
    }
    if (b.type === "pdf")
      return (
        <a
          key={i}
          href={mediaUrl(b.url)}
          target="_blank"
          rel="noreferrer"
          className="card-soft p-4 flex items-center gap-3 hover:shadow-glow transition"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-rosa text-white grid place-items-center">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{b.name ?? "Descargar archivo"}</div>
            <div className="text-xs muted">Documento descargable</div>
          </div>
        </a>
      );
    if (b.type === "link")
      return (
        <a
          key={i}
          href={b.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
        >
          {b.label || b.url} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      );
    if (b.type === "button")
      return (
        <a key={i} href={b.url} target="_blank" rel="noreferrer" className="btn-primary w-max">
          {b.label || "Abrir"}
        </a>
      );
    if (b.type === "section") {
      const hasMedia = b.image_url || b.video_url || b.pdf_url || b.external_url;
      return (
        <section key={i} className="card-soft p-5 space-y-4">
          {!insideAccordion && b.title && <h2 className="heading-md">{b.title}</h2>}
          {b.text && <p className="whitespace-pre-wrap leading-relaxed">{b.text}</p>}
          {b.image_url && <img src={mediaUrl(b.image_url)} alt={b.title ?? ""} className="w-full rounded-xl" />}
          {b.video_url && (
            isEmbeddable(b.video_url) ? (
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                <iframe src={toEmbed(b.video_url)} className="w-full h-full" allowFullScreen />
              </div>
            ) : (
              <video src={mediaUrl(b.video_url)} controls className="w-full rounded-xl" />
            )
          )}
          {hasMedia && (
            <div className="grid gap-2">
              {b.pdf_url && (
                <a href={mediaUrl(b.pdf_url)} target="_blank" rel="noreferrer" className="btn-secondary justify-between">
                  <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Ver PDF</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {b.external_url && (
                <a href={b.external_url} target="_blank" rel="noreferrer" className="btn-secondary justify-between">
                  <span className="inline-flex items-center gap-2"><ExternalLink className="h-4 w-4" /> Abrir enlace</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}
        </section>
      );
    }
    return null;
  };

  const nutritionDisplayGroups: Array<{ id: string; title: string; entries: Array<{ block: any; index: number }> }> = [];
  if (table === "nutrition_items") {
    let imageNumber = 0;
    for (let index = 0; index < orderedBlocks.length; index += 1) {
      const block: any = orderedBlocks[index];
      const next: any = orderedBlocks[index + 1];
      if (block?.type === "title" && next?.type === "text") {
        const entries = [{ block: next, index: index + 1 }];
        const possiblePdf: any = orderedBlocks[index + 2];
        if (possiblePdf?.type === "pdf" && String(possiblePdf.name ?? "").toLowerCase() === String(block.value ?? "").toLowerCase()) {
          entries.push({ block: possiblePdf, index: index + 2 });
          index += 1;
        }
        nutritionDisplayGroups.push({ id: `text-${index}`, title: String(block.value || "Información"), entries });
        index += 1;
        continue;
      }
      if (block?.type === "nutrition_label") {
        nutritionDisplayGroups.push({ id: `nutrition-${index}`, title: "Información nutricional", entries: [{ block, index }] });
        continue;
      }
      if (block?.type === "official_label") {
        nutritionDisplayGroups.push({ id: `official-label-${index}`, title: "Etiqueta nutricional oficial", entries: [{ block, index }] });
        continue;
      }
      if (block?.type === "official_spoon") {
        nutritionDisplayGroups.push({ id: `spoon-${index}`, title: "Cuchara oficial Herbalife", entries: [{ block, index }] });
        continue;
      }
      if (block?.type === "image") {
        imageNumber += 1;
        nutritionDisplayGroups.push({ id: `image-${index}`, title: `Imagen ${imageNumber}`, entries: [{ block, index }] });
        continue;
      }
      if (block?.type === "pdf" && String(block.name ?? "").toLowerCase() === "beneficios") {
        nutritionDisplayGroups.push({ id: `benefits-pdf-${index}`, title: "Beneficios", entries: [{ block, index }] });
        continue;
      }
      if (["video", "pdf", "link", "button"].includes(block?.type)) {
        const type = block.type;
        const entries = [{ block, index }];
        while (orderedBlocks[index + 1]?.type === type) {
          index += 1;
          entries.push({ block: orderedBlocks[index], index });
        }
        const title = type === "video" ? "Vídeos" : type === "pdf" ? "PDFs" : "Enlaces externos";
        nutritionDisplayGroups.push({ id: `${type}-${index}`, title, entries });
        continue;
      }
      if (block?.type === "section") {
        nutritionDisplayGroups.push({
          id: `section-${block.id || index}`,
          title: String(block.title || `Sección ${nutritionDisplayGroups.length + 1}`),
          entries: [{ block, index }],
        });
        continue;
      }
      nutritionDisplayGroups.push({ id: `content-${index}`, title: "Información", entries: [{ block, index }] });
    }
  }

  const toggleNutritionSection = (id: string) => {
    setOpenNutritionSections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <article className={`pb-8 ${table === "nutrition_items" ? "nutrition-detail-page" : ""}`}>
      <BackButton fallbackTo={basePath} className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>

      {coverImage && (
        table === "nutrition_items" ? (
          <div className="nutrition-detail-cover mb-4">
            <img src={mediaUrl(coverImage)} alt={title} />
          </div>
        ) : (
          <img src={mediaUrl(coverImage)} alt={title} className="w-full h-56 object-cover rounded-2xl mb-4" />
        )
      )}
      {cat && (
        <div className={`text-xs mb-1 ${table === "nutrition_items" ? "nutrition-detail-category" : "muted"}`}>
          {cat.emoji} {cat.label}
        </div>
      )}
      <h1 className="heading-lg mb-4">{title}</h1>
      {description && <p className="mb-5 leading-relaxed muted">{description}</p>}

      <div className="space-y-4">
        {table === "nutrition_items"
          ? nutritionDisplayGroups.map((group) => {
              const open = openNutritionSections.has(group.id);
              return (
                <NutritionClientAccordion key={group.id} title={group.title} open={open} onToggle={() => toggleNutritionSection(group.id)}>
                  <div className="mt-3 space-y-4">
                    {group.entries.map(({ block, index }) => renderBlock(block, index, true))}
                  </div>
                </NutritionClientAccordion>
              );
            })
          : orderedBlocks.map((block, index) => renderBlock(block, index))}
        {table !== "nutrition_items" && attachmentBlocks.length > 0 && (
          <section className="card-soft p-4">
            <h2 className="font-medium text-sm flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              Recursos disponibles
            </h2>
            <div className="grid gap-2">
              {attachmentBlocks.map((b: any, index) => (
                <a
                  key={`${b.type}-${index}-${b.url ?? b.label ?? ""}`}
                  href={resourceHref(b)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary justify-between"
                >
                  <span className="inline-flex items-center gap-2">
                    {resourceIcon(b.type)}
                    {resourceLabel(b)}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              {attachmentBlocks
                .filter((b: any) => b.type === "image" || b.type === "video")
                .map((block, index) => renderBlock(block, index))}
            </div>
          </section>
        )}
        {blocks.length === 0 && !it.cover_image && (
          <div className="card-soft p-5 text-sm muted">Esta publicación todavía no tiene contenido visible.</div>
        )}
      </div>
    </article>
  );
}

function NutritionClientAccordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="card-soft p-4">
      <button type="button" className="w-full flex items-center justify-between gap-3 text-left" onClick={onToggle} aria-expanded={open}>
        <h2 className="font-serif text-xl">{title}</h2>
        <span className="h-8 w-8 rounded-full border border-primary/30 grid place-items-center text-primary font-semibold" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && children}
    </section>
  );
}
