import { Download, ExternalLink, Film, Image as ImageIcon, Play } from "lucide-react";
import { ContentBlock, ContentItem, embedUrl, legacyItems } from "@/lib/challengeExtras";
import { mediaUrl } from "@/lib/mediaStorage";

export default function ChallengeContentView({ block }: { block: ContentBlock }) {
  const ordered = block.blocks?.length ? block.blocks : legacyItems(block);
  if (ordered.length) {
    const resources = ordered.filter(item => item.type === "image" || item.type === "video" || item.type === "file" || item.type === "link");
    return (
      <div className="space-y-4">
        <ResourcesAvailable items={resources} />
        {ordered.map((item) => <ContentCard key={item.id} item={item} />)}
      </div>
    );
  }

  const sections = block.sections ?? [];
  const images = block.images ?? [];
  const videos = block.videos ?? [];
  const files = block.files ?? [];
  const empty = !block.title && sections.every(s => !s.heading && !s.body)
    && images.length === 0 && videos.length === 0 && files.length === 0;

  if (empty) {
    return (
      <div className="card-elegant p-8 text-center muted text-sm">
        Aún no hay contenido aquí.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ResourcesAvailable items={legacyItems(block).filter(item => item.type === "image" || item.type === "video" || item.type === "file" || item.type === "link")} />

      {images.length > 0 && (
        <section className="space-y-2">
          {images.length === 1 ? (
            <img src={mediaUrl(images[0])} className="w-full rounded-[24px] object-cover" loading="lazy" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {images.map((u, i) => <img key={i} src={mediaUrl(u)} className="w-full h-40 object-cover rounded-2xl" loading="lazy" />)}
            </div>
          )}
        </section>
      )}

      {videos.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-lg flex items-center gap-2" style={{ color: "hsl(var(--plum))" }}>
            <Play className="h-4 w-4" /> Vídeos
          </h2>
          {videos.map((v, i) => {
            const emb = embedUrl(v);
            return (
              <div key={i} className="rounded-2xl overflow-hidden border border-border bg-black/5 aspect-video">
                {v.kind === "upload"
                  ? <video src={mediaUrl(v.url)} controls className="w-full h-full" />
                  : emb
                    ? <iframe src={emb} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" />
                    : <a href={v.url} target="_blank" rel="noreferrer" className="grid place-items-center h-full text-sm muted">
                        <Film className="h-5 w-5 mr-2" /> Abrir vídeo
                      </a>}
              </div>
            );
          })}
        </section>
      )}

      {sections.map((s, i) => (
        (s.heading || s.body) ? (
          <section key={i} className="rounded-[24px] p-5 border border-white/80"
            style={{ background: "linear-gradient(160deg, hsl(0 0% 100% / 0.96), hsl(320 60% 97%) 100%)", boxShadow: "0 12px 36px -16px hsl(315 55% 45% / 0.18)" }}>
            {s.heading && <h2 className="font-serif text-lg mb-2" style={{ color: "hsl(var(--plum))" }}>{s.heading}</h2>}
            {s.body && <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.body}</p>}
          </section>
        ) : null
      ))}

      {files.length > 0 && (
        <section className="card-elegant p-5">
          <h2 className="font-serif text-lg mb-3" style={{ color: "hsl(var(--plum))" }}>Descargables</h2>
          <ul className="space-y-2">
            {files.map((file, i) => (
              <li key={i}>
                <a href={mediaUrl(file.url)} target="_blank" rel="noreferrer" download
                  className="flex items-center gap-3 p-3 rounded-2xl bg-muted/60 hover:bg-muted transition">
                  <Download className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm flex-1 truncate">{file.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function resourceUrl(item: ContentItem) {
  if (item.type === "image") return mediaUrl(item.url);
  if (item.type === "video") return item.video.kind === "upload" ? mediaUrl(item.video.url) : item.video.url;
  if (item.type === "file") return mediaUrl(item.file.url);
  if (item.type === "link") return item.url;
  return "#";
}

function resourceLabel(item: ContentItem) {
  if (item.type === "image") return item.title || "Ver imagen";
  if (item.type === "video") return item.title || "Ver vídeo";
  if (item.type === "file") return item.title || item.file.name || "Ver PDF";
  if (item.type === "link") return item.title || "Abrir enlace";
  return "Abrir recurso";
}

function resourceIcon(item: ContentItem) {
  if (item.type === "image") return <ImageIcon className="h-4 w-4" />;
  if (item.type === "video") return <Film className="h-4 w-4" />;
  if (item.type === "file") return <Download className="h-4 w-4" />;
  return <ExternalLink className="h-4 w-4" />;
}

function ResourcesAvailable({ items }: { items: ContentItem[] }) {
  if (!items.length) return null;
  return (
    <section className="card-elegant p-5">
      <h2 className="font-serif text-lg mb-3 flex items-center gap-2" style={{ color: "hsl(var(--plum))" }}>
        <Download className="h-4 w-4" />
        Recursos disponibles
      </h2>
      <div className="grid gap-2">
        {items.map((item) => (
          <a
            key={item.id}
            href={resourceUrl(item)}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary justify-between"
          >
            <span className="inline-flex items-center gap-2">
              {resourceIcon(item)}
              {resourceLabel(item)}
            </span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ))}
      </div>
    </section>
  );
}

function ContentCard({ item }: { item: ContentItem }) {
  const cardStyle = { background: "linear-gradient(160deg, hsl(0 0% 100% / 0.96), hsl(320 60% 97%) 100%)", boxShadow: "0 12px 36px -16px hsl(315 55% 45% / 0.18)" };
  if (item.type === "image") return (
    <section className="overflow-hidden rounded-[24px] border border-white/80" style={cardStyle}>
      <img src={mediaUrl(item.url)} alt={item.title ?? ""} className="w-full max-h-[420px] object-cover" loading="lazy" />
      {item.title && <p className="px-4 py-3 text-sm muted">{item.title}</p>}
    </section>
  );
  if (item.type === "video") {
    const emb = embedUrl(item.video);
    return <section className="rounded-[24px] overflow-hidden border border-white/80" style={cardStyle}>
      {item.title && <h2 className="font-serif text-lg px-5 pt-5" style={{ color: "hsl(var(--plum))" }}>{item.title}</h2>}
      <div className={`bg-black/5 aspect-video ${item.title ? "mt-4" : ""}`}>
      {item.video.kind === "upload" ? <video src={mediaUrl(item.video.url)} controls className="w-full h-full" />
          : emb ? <iframe src={emb} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" />
            : <a href={item.video.url} target="_blank" rel="noreferrer" className="grid place-items-center h-full text-sm muted"><Film className="h-5 w-5 mr-2" /> Abrir vídeo</a>}
      </div>
    </section>;
  }
  if (item.type === "file") return (
    <a href={mediaUrl(item.file.url)} target="_blank" rel="noreferrer" download className="card-elegant p-5 flex items-center gap-4 hover:-translate-y-0.5 transition">
      <div className="h-11 w-11 rounded-2xl grid place-items-center bg-primary/10 text-primary"><Download className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1"><div className="font-serif text-base" style={{ color: "hsl(var(--plum))" }}>{item.title || item.file.name}</div><div className="text-xs muted mt-1 truncate">{item.file.name}</div></div>
      <Download className="h-4 w-4 muted" />
    </a>
  );
  if (item.type === "link") return (
    <a href={item.url} target="_blank" rel="noreferrer" className="card-elegant p-5 flex items-center gap-4 hover:-translate-y-0.5 transition">
      <div className="h-11 w-11 rounded-2xl grid place-items-center bg-primary/10 text-primary"><ExternalLink className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1"><div className="font-serif text-base" style={{ color: "hsl(var(--plum))" }}>{item.title || "Abrir enlace"}</div>{item.description && <div className="text-xs muted mt-1">{item.description}</div>}</div>
      <ExternalLink className="h-4 w-4 muted" />
    </a>
  );
  return (
    <section className="rounded-[24px] p-5 border border-white/80" style={cardStyle}>
      {item.title && <h2 className="font-serif text-lg mb-2" style={{ color: "hsl(var(--plum))" }}>{item.title}</h2>}
      {item.body && <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.body}</p>}
    </section>
  );
}
