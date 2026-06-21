import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImagePlus, Film, FileUp, Youtube, Link2, ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ContentBlock, FileItem, Section, VideoItem } from "@/lib/challengeExtras";

const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days; resign on read for longer access

async function uploadToBucket(file: File, prefix: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("challenge-media").upload(path, file);
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage.from("challenge-media").createSignedUrl(path, SIGNED_TTL);
  if (sErr || !data) throw sErr ?? new Error("No se pudo firmar el archivo");
  return data.signedUrl;
}

type Props = {
  block: ContentBlock;
  onChange: (patch: Partial<ContentBlock>) => void;
  pathKey: string;
  titleLabel?: string;
  showTitle?: boolean;
};

export default function ChallengeBlockEditor({ block, onChange, pathKey, titleLabel, showTitle = true }: Props) {
  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const sections = block.sections ?? [];
  const images = block.images ?? [];
  const videos = block.videos ?? [];
  const files = block.files ?? [];

  const addImages = async (fl: FileList | null) => {
    if (!fl || !fl.length) return;
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(fl)) urls.push(await uploadToBucket(file, `images/${pathKey}`));
      onChange({ images: [...images, ...urls] });
      toast.success("Imágenes añadidas");
    } catch (e: any) { toast.error(e.message ?? "Error al subir"); }
    finally { setBusy(false); if (imgInput.current) imgInput.current.value = ""; }
  };
  const removeImage = (i: number) => onChange({ images: images.filter((_, j) => j !== i) });
  const moveImage = (i: number, dir: -1 | 1) => {
    const arr = [...images]; const t = arr[i + dir]; if (t === undefined) return;
    arr[i + dir] = arr[i]; arr[i] = t; onChange({ images: arr });
  };

  const addUploadVideo = async (fl: FileList | null) => {
    if (!fl || !fl.length) return;
    setBusy(true);
    try {
      const items: VideoItem[] = [];
      for (const file of Array.from(fl)) items.push({ kind: "upload", url: await uploadToBucket(file, `videos/${pathKey}`) });
      onChange({ videos: [...videos, ...items] });
      toast.success("Vídeo subido");
    } catch (e: any) { toast.error(e.message ?? "Error al subir"); }
    finally { setBusy(false); if (vidInput.current) vidInput.current.value = ""; }
  };
  const addVideoLink = () => {
    const url = linkUrl.trim(); if (!url) return;
    const kind: VideoItem["kind"] = /vimeo/i.test(url) ? "vimeo" : "youtube";
    onChange({ videos: [...videos, { kind, url }] });
    setLinkUrl("");
  };
  const removeVideo = (i: number) => onChange({ videos: videos.filter((_, j) => j !== i) });

  const addFiles = async (fl: FileList | null) => {
    if (!fl || !fl.length) return;
    setBusy(true);
    try {
      const items: FileItem[] = [];
      for (const file of Array.from(fl)) items.push({ name: file.name, url: await uploadToBucket(file, `files/${pathKey}`) });
      onChange({ files: [...files, ...items] });
      toast.success("Archivos añadidos");
    } catch (e: any) { toast.error(e.message ?? "Error al subir"); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  const removeFile = (i: number) => onChange({ files: files.filter((_, j) => j !== i) });

  const addSection = () => onChange({ sections: [...sections, { heading: "", body: "" }] });
  const updateSection = (i: number, patch: Partial<Section>) =>
    onChange({ sections: sections.map((s, j) => j === i ? { ...s, ...patch } : s) });
  const removeSection = (i: number) => onChange({ sections: sections.filter((_, j) => j !== i) });
  const moveSection = (i: number, dir: -1 | 1) => {
    const arr = [...sections]; const t = arr[i + dir]; if (t === undefined) return;
    arr[i + dir] = arr[i]; arr[i] = t; onChange({ sections: arr });
  };

  return (
    <div className="space-y-2">
      {showTitle && (
        <input
          className="field"
          placeholder={titleLabel ?? "Título (opcional)"}
          value={block.title ?? ""}
          onChange={e => onChange({ title: e.target.value })}
        />
      )}

      <div className="space-y-2">
        {sections.map((s, i) => (
          <div key={i} className="rounded-xl border border-border/60 p-2 space-y-1.5 bg-background/60">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider muted">Sección {i + 1}</div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveSection(i, -1)} className="muted"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => moveSection(i, 1)} className="muted"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => removeSection(i)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <input className="field" placeholder="Título de la sección (opcional)" value={s.heading ?? ""} onChange={e => updateSection(i, { heading: e.target.value })} />
            <textarea className="field min-h-24" placeholder="Texto libre" value={s.body ?? ""} onChange={e => updateSection(i, { body: e.target.value })} />
          </div>
        ))}
        <button type="button" onClick={addSection}
          className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70">
          <Plus className="h-3.5 w-3.5" /> Añadir sección de texto
        </button>
      </div>

      <div className="pt-1">
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={() => imgInput.current?.click()} disabled={busy}
            className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70">
            <ImagePlus className="h-3.5 w-3.5" /> Añadir imágenes
          </button>
          <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={e => addImages(e.target.files)} />
        </div>
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((u, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden border border-border">
                <img src={u} className="w-full h-20 object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 bg-black/40 opacity-0 group-hover:opacity-100 transition">
                  <button type="button" onClick={() => moveImage(i, -1)} className="text-white"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => moveImage(i, 1)} className="text-white"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => removeImage(i)} className="text-white"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-1">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <button type="button" onClick={() => vidInput.current?.click()} disabled={busy}
            className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70">
            <Film className="h-3.5 w-3.5" /> Subir vídeo
          </button>
          <input ref={vidInput} type="file" accept="video/*" hidden onChange={e => addUploadVideo(e.target.files)} />
          <div className="flex-1 flex gap-1">
            <input className="field flex-1 text-xs" placeholder="Pega enlace YouTube/Vimeo" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
            <button type="button" onClick={addVideoLink} className="px-3 rounded-full bg-muted text-xs inline-flex items-center gap-1"><Link2 className="h-3 w-3" /></button>
          </div>
        </div>
        {videos.length > 0 && (
          <ul className="space-y-1">
            {videos.map((v, i) => (
              <li key={i} className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-2 py-1.5">
                {v.kind === "upload" ? <Film className="h-3.5 w-3.5 shrink-0" /> : <Youtube className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate flex-1">{v.url}</span>
                <button type="button" onClick={() => removeVideo(i)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="pt-1">
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}
            className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70">
            <FileUp className="h-3.5 w-3.5" /> Añadir archivo (PDF, menú…)
          </button>
          <input ref={fileInput} type="file" multiple hidden onChange={e => addFiles(e.target.files)} />
        </div>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((file, i) => (
              <li key={i} className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-2 py-1.5">
                <FileUp className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <button type="button" onClick={() => removeFile(i)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
