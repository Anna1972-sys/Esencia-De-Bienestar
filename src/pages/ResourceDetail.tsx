import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ExternalLink, FileText, Image as ImageIcon, PlayCircle, Video } from "lucide-react";
import type { ResourceBlock } from "@/lib/resourceCategories";
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

export default function ResourceDetail() {
  const { id } = useParams();
  const [it, setIt] = useState<any | null>(null);
  const [cat, setCat] = useState<{ name: string; icon: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from("resources").select("*").eq("id", id).maybeSingle().then(async ({ data }) => {
      setIt(data);
      setLoading(false);
      if (data?.category_id) {
        const { data: c } = await supabase.from("resource_categories").select("name, icon").eq("id", data.category_id).maybeSingle();
        setCat(c as any);
      }
    });
  }, [id]);

  if (loading) return <div className="muted">Cargando…</div>;
  if (!it) return (
    <div>
      <BackButton fallbackTo="/app/recursos" className="text-sm muted inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-4 w-4" /> Volver</BackButton>
      <div className="card-soft p-6 text-center muted">Publicación no encontrada.</div>
    </div>
  );

  const blocks: ResourceBlock[] = Array.isArray(it.blocks) ? it.blocks : [];
  const attachmentBlocks = blocks.filter((b: any) =>
    ["image", "video", "pdf", "link", "button"].includes(b?.type) && (b.url || b.label)
  );
  const textBlocks = blocks.filter((b: any) => !["image", "video", "pdf", "link", "button"].includes(b?.type));

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

  const renderAttachmentPreview = (b: any, i: number) => {
    if (b.type === "image") return (
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
    return null;
  };

  return (
    <article className="pb-8">
      <BackButton fallbackTo="/app/recursos" className="text-sm muted inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-4 w-4" /> Volver</BackButton>

      {it.cover_image && <img src={mediaUrl(it.cover_image)} alt={it.title} className="w-full h-56 object-cover rounded-2xl mb-4" />}
      {cat && <div className="text-xs muted mb-1">{cat.icon} {cat.name}</div>}
      <h1 className="heading-lg mb-4">{it.title}</h1>

      <div className="space-y-4">
        {textBlocks.map((b, i) => {
          if (b.type === "text") return <p key={i} className="whitespace-pre-wrap leading-relaxed">{b.value}</p>;
          if ((b as any).type === "title") return <h2 key={i} className="heading-md mt-2">{(b as any).value}</h2>;
          if ((b as any).type === "subtitle") return <h3 key={i} className="font-serif text-lg" style={{ color: "hsl(var(--plum))" }}>{(b as any).value}</h3>;
          return null;
        })}

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
                .map(renderAttachmentPreview)}
            </div>
          </section>
        )}

        {blocks.length === 0 && it.body && <p className="whitespace-pre-wrap leading-relaxed">{it.body}</p>}
        {blocks.length === 0 && it.url && (
          <a href={it.url} target="_blank" rel="noreferrer" className="card-soft p-4 flex items-center gap-3">
            <PlayCircle className="h-5 w-5 text-primary" /> Abrir vídeo
          </a>
        )}
      </div>
    </article>
  );
}
