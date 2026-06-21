import { Download, Film, Play } from "lucide-react";
import { ContentBlock, embedUrl } from "@/lib/challengeExtras";

export default function ChallengeContentView({ block }: { block: ContentBlock }) {
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
      {images.length > 0 && (
        <section className="space-y-2">
          {images.length === 1 ? (
            <img src={images[0]} className="w-full rounded-[24px] object-cover" loading="lazy" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {images.map((u, i) => <img key={i} src={u} className="w-full h-40 object-cover rounded-2xl" loading="lazy" />)}
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
                  ? <video src={v.url} controls className="w-full h-full" />
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
                <a href={file.url} target="_blank" rel="noreferrer" download
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
