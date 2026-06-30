import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileText, ExternalLink, Image as ImageIcon, Video } from "lucide-react";
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

  const cat = categories.find((c) => c.key === it.category);
  const blocks: ContentBlock[] = Array.isArray(it.blocks) ? it.blocks : [];
  const attachmentBlocks = blocks.filter((b: any) =>
    ["image", "video", "pdf", "link", "button"].includes(b?.type) && (b.url || b.label)
  );
  const textBlocks = blocks.filter((b: any) => !["image", "video", "pdf", "link", "button"].includes(b?.type));
  const description = it.description || it.subtitle || "";

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

  const renderBlock = (b: any, i: number) => {
    if (b.type === "title") return <h2 key={i} className="heading-md mt-2">{b.value}</h2>;
    if (b.type === "subtitle") return <h3 key={i} className="font-serif text-lg" style={{ color: "hsl(var(--plum))" }}>{b.value}</h3>;
    if (b.type === "text")
      return (
        <p key={i} className="whitespace-pre-wrap leading-relaxed">
          {b.value}
        </p>
      );
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
    return null;
  };

  return (
    <article className="pb-8">
      <BackButton fallbackTo={basePath} className="text-sm muted inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Volver
      </BackButton>

      {it.cover_image && (
        <img src={mediaUrl(it.cover_image)} alt={it.title} className="w-full h-56 object-cover rounded-2xl mb-4" />
      )}
      {cat && (
        <div className="text-xs muted mb-1">
          {cat.emoji} {cat.label}
        </div>
      )}
      <h1 className="heading-lg mb-4">{it.title}</h1>
      {description && <p className="mb-5 leading-relaxed muted">{description}</p>}

      <div className="space-y-4">
        {textBlocks.map(renderBlock)}
        {attachmentBlocks.length > 0 && (
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
                .map(renderBlock)}
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
