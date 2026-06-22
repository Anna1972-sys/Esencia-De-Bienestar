import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileText, PlayCircle } from "lucide-react";
import type { ResourceBlock } from "@/lib/resourceCategories";

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
      <Link to="/app/recursos" className="text-sm muted inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-4 w-4" /> Volver</Link>
      <div className="card-soft p-6 text-center muted">Publicación no encontrada.</div>
    </div>
  );

  const blocks: ResourceBlock[] = Array.isArray(it.blocks) ? it.blocks : [];

  return (
    <article className="pb-8">
      <Link to="/app/recursos" className="text-sm muted inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-4 w-4" /> Volver</Link>

      {it.cover_image && <img src={it.cover_image} alt={it.title} className="w-full h-56 object-cover rounded-2xl mb-4" />}
      {cat && <div className="text-xs muted mb-1">{cat.icon} {cat.name}</div>}
      <h1 className="heading-lg mb-4">{it.title}</h1>

      <div className="space-y-4">
        {blocks.map((b, i) => {
          if (b.type === "text") return <p key={i} className="whitespace-pre-wrap leading-relaxed">{b.value}</p>;
          if (b.type === "image") return (
            <figure key={i}>
              <img src={b.url} alt={b.caption ?? ""} className="w-full rounded-xl" />
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
                  <video src={b.url} controls className="w-full rounded-xl" />
                )}
                {b.caption && <figcaption className="text-xs muted text-center mt-1">{b.caption}</figcaption>}
              </figure>
            );
          }
          if (b.type === "pdf") return (
            <a key={i} href={b.url} target="_blank" rel="noreferrer" className="card-soft p-4 flex items-center gap-3 hover:shadow-glow transition">
              <div className="h-10 w-10 rounded-xl bg-gradient-rosa text-white grid place-items-center"><FileText className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{b.name ?? "Descargar PDF"}</div>
                <div className="text-xs muted">Documento descargable</div>
              </div>
            </a>
          );
          return null;
        })}

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
