import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, ExternalLink, FileUp, Film, ImagePlus, Link2, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { ContentBlock, ContentItem, FileItem, VideoItem } from "@/lib/challengeExtras";

const SIGNED_TTL = 60 * 60 * 24 * 7;

async function uploadToBucket(file: File, prefix: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("challenge-media").upload(path, file);
  if (error) throw error;
  const { data, error: signError } = await supabase.storage.from("challenge-media").createSignedUrl(path, SIGNED_TTL);
  if (signError || !data) throw signError ?? new Error("No se pudo preparar el archivo");
  return data.signedUrl;
}

type Props = { block: ContentBlock; onChange: (patch: Partial<ContentBlock>) => void; pathKey: string; titleLabel?: string; showTitle?: boolean };
const newId = () => crypto.randomUUID();

export default function ChallengeBlockEditor({ block, onChange, pathKey, titleLabel, showTitle = true }: Props) {
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const blocks = block.blocks ?? [];

  const setBlocks = (next: ContentItem[]) => onChange({ blocks: next });
  const add = (item: ContentItem) => setBlocks([...blocks, item]);
  const update = (id: string, patch: Record<string, unknown>) => setBlocks(blocks.map(item => item.id === id ? { ...item, ...patch } as ContentItem : item));
  const remove = (id: string) => setBlocks(blocks.filter(item => item.id !== id));
  const move = (index: number, direction: -1 | 1) => {
    const next = [...blocks]; const target = index + direction;
    if (!next[target]) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  };

  const upload = async (files: FileList | null, kind: "image" | "video" | "file") => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const items: ContentItem[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadToBucket(file, `${kind}s/${pathKey}`);
        if (kind === "image") items.push({ id: newId(), type: "image", url, title: "" });
        if (kind === "video") items.push({ id: newId(), type: "video", video: { kind: "upload", url }, title: file.name.replace(/\.[^.]+$/, "") });
        if (kind === "file") items.push({ id: newId(), type: "file", file: { name: file.name, url }, title: "" });
      }
      setBlocks([...blocks, ...items]);
      toast.success("Bloque añadido");
    } catch (error: any) { toast.error(error.message ?? "No se pudo subir el archivo"); }
    finally { setBusy(false); if (imageInput.current) imageInput.current.value = ""; if (videoInput.current) videoInput.current.value = ""; if (fileInput.current) fileInput.current.value = ""; }
  };

  const addVideoLink = () => {
    const url = videoUrl.trim(); if (!url) return;
    const kind: VideoItem["kind"] = /vimeo/i.test(url) ? "vimeo" : "youtube";
    add({ id: newId(), type: "video", video: { kind, url }, title: "" }); setVideoUrl("");
  };
  const addExternalLink = () => { const url = externalUrl.trim(); if (!url) return; add({ id: newId(), type: "link", url, title: "", description: "" }); setExternalUrl(""); };

  const sectionItems = (type: ContentItem["type"]) => blocks.map((item, index) => ({ item, index })).filter(entry => entry.item.type === type);

  return <div className="space-y-4">
    {showTitle && <input className="field" placeholder={titleLabel ?? "Título (opcional)"} value={block.title ?? ""} onChange={e => onChange({ title: e.target.value })} />}

    <ContentSection title="Bloque de textos" description="Títulos, subtítulos, párrafos y listas." count={sectionItems("text").length} action={<button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => add({ id: newId(), type: "text", title: "", body: "" })}><Type className="h-3.5 w-3.5" /> Añadir texto</button>}>
      {sectionItems("text").map(({ item, index }) => <EditorCard key={item.id} item={item} index={index} total={blocks.length} onUpdate={update} onMove={move} onRemove={remove} />)}
    </ContentSection>
    <ContentSection title="Bloque de vídeos" description="Sube vídeos o añade enlaces de YouTube y Vimeo." count={sectionItems("video").length} action={<button type="button" className="btn-ghost px-3 py-2 text-xs" disabled={busy} onClick={() => videoInput.current?.click()}><Film className="h-3.5 w-3.5" /> Subir vídeo</button>}>
      <div className="flex gap-1"><input className="field text-xs" placeholder="Enlace de YouTube o Vimeo" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} /><button type="button" onClick={addVideoLink} className="btn-secondary px-3"><Film className="h-3.5 w-3.5" /></button></div>
      {sectionItems("video").map(({ item, index }) => <EditorCard key={item.id} item={item} index={index} total={blocks.length} onUpdate={update} onMove={move} onRemove={remove} />)}
    </ContentSection>
    <ContentSection title="Bloque de imágenes" description="Añade imágenes y edita su pie de foto." count={sectionItems("image").length} action={<button type="button" className="btn-ghost px-3 py-2 text-xs" disabled={busy} onClick={() => imageInput.current?.click()}><ImagePlus className="h-3.5 w-3.5" /> Añadir imagen</button>}>
      {sectionItems("image").map(({ item, index }) => <EditorCard key={item.id} item={item} index={index} total={blocks.length} onUpdate={update} onMove={move} onRemove={remove} />)}
    </ContentSection>
    <ContentSection title="Bloque de PDFs descargables" description="Sube documentos PDF para descargar." count={sectionItems("file").length} action={<button type="button" className="btn-ghost px-3 py-2 text-xs" disabled={busy} onClick={() => fileInput.current?.click()}><FileUp className="h-3.5 w-3.5" /> Añadir PDF</button>}>
      {sectionItems("file").map(({ item, index }) => <EditorCard key={item.id} item={item} index={index} total={blocks.length} onUpdate={update} onMove={move} onRemove={remove} />)}
    </ContentSection>
    <ContentSection title="Bloque de enlaces externos" description="Comparte recursos externos de confianza." count={sectionItems("link").length} action={null}>
      <div className="flex gap-1"><input className="field text-xs" placeholder="https://..." value={externalUrl} onChange={e => setExternalUrl(e.target.value)} /><button type="button" onClick={addExternalLink} className="btn-secondary px-3"><Link2 className="h-3.5 w-3.5" /></button></div>
      {sectionItems("link").map(({ item, index }) => <EditorCard key={item.id} item={item} index={index} total={blocks.length} onUpdate={update} onMove={move} onRemove={remove} />)}
    </ContentSection>
    <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={e => upload(e.target.files, "image")} />
    <input ref={videoInput} type="file" accept="video/*" multiple hidden onChange={e => upload(e.target.files, "video")} />
    <input ref={fileInput} type="file" accept="application/pdf" multiple hidden onChange={e => upload(e.target.files, "file")} />
  </div>;
}

function ContentSection({ title, description, count, action, children }: { title: string; description: string; count: number; action: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border/70 bg-card/60 p-3 space-y-3"><div className="flex items-start justify-between gap-3"><div><div className="font-serif text-base" style={{ color: "hsl(var(--plum))" }}>{title}</div><p className="text-xs muted mt-0.5">{description}</p></div><span className="text-[10px] rounded-full bg-muted px-2 py-1 shrink-0">{count}</span></div>{action && <div>{action}</div>}{count === 0 && <p className="text-xs muted border-t border-border/50 pt-3">Aún no hay contenido en esta sección.</p>}{children}</section>;
}

function EditorCard({ item, index, total, onUpdate, onMove, onRemove }: { item: ContentItem; index: number; total: number; onUpdate: (id: string, patch: Record<string, unknown>) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: (id: string) => void }) {
  const labels = { text: "Texto", image: "Imagen", video: "Vídeo", file: "PDF descargable", link: "Enlace externo" };
  return <div className="rounded-2xl border border-border/70 bg-card/70 p-3 space-y-2">
    <div className="flex items-center justify-between"><span className="text-[10px] font-bold tracking-wider uppercase muted">{labels[item.type]} · bloque {index + 1}</span><div className="flex gap-1"><button type="button" disabled={!index} onClick={() => onMove(index, -1)} className="muted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" disabled={index === total - 1} onClick={() => onMove(index, 1)} className="muted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onRemove(item.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div></div>
    {item.type === "text" && <><input className="field" placeholder="Título o subtítulo" value={item.title ?? ""} onChange={e => onUpdate(item.id, { title: e.target.value })} /><textarea className="field min-h-28" placeholder="Párrafos y listas (una línea por punto)" value={item.body ?? ""} onChange={e => onUpdate(item.id, { body: e.target.value })} /></>}
    {item.type === "image" && <><img src={item.url} alt="" className="h-32 w-full object-cover rounded-xl" /><input className="field" placeholder="Pie de imagen (opcional)" value={item.title ?? ""} onChange={e => onUpdate(item.id, { title: e.target.value })} /></>}
    {item.type === "video" && <><input className="field" placeholder="Título del vídeo (opcional)" value={item.title ?? ""} onChange={e => onUpdate(item.id, { title: e.target.value })} /><div className="text-xs muted truncate">{item.video.url}</div></>}
    {item.type === "file" && <><input className="field" placeholder="Título del PDF (opcional)" value={item.title ?? ""} onChange={e => onUpdate(item.id, { title: e.target.value })} /><div className="text-xs muted truncate">{item.file.name}</div></>}
    {item.type === "link" && <><input className="field" placeholder="Título del enlace" value={item.title ?? ""} onChange={e => onUpdate(item.id, { title: e.target.value })} /><input className="field" placeholder="Descripción breve (opcional)" value={item.description ?? ""} onChange={e => onUpdate(item.id, { description: e.target.value })} /><div className="text-xs muted truncate inline-flex gap-1 items-center"><ExternalLink className="h-3 w-3" /> {item.url}</div></>}
  </div>;
}
