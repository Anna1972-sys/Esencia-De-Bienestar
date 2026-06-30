import { useRef, useState } from "react";
import { Film, Link2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SIGNED_TTL = 60 * 60 * 24 * 7;

type Props = {
  /** Storage bucket. Must enforce admin-only writes via RLS. */
  bucket?: string;
  /** Folder/prefix inside the bucket. */
  folder?: string;
  /** Current value (signed URL of uploaded file OR youtube/vimeo URL). */
  value: string;
  onChange: (url: string) => void;
  label?: string;
};

function youtubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m?.[1] ?? null;
}
function vimeoId(url: string) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m?.[1] ?? null;
}
function isUploadedFile(url: string) {
  return /\/storage\/v1\/object\//.test(url) || /^blob:/.test(url);
}
export function videoEmbedUrl(url: string): string | null {
  const y = youtubeId(url);
  if (y) return `https://www.youtube.com/embed/${y}`;
  const v = vimeoId(url);
  if (v) return `https://player.vimeo.com/video/${v}`;
  return null;
}
export function videoThumbnail(url: string): string | null {
  const y = youtubeId(url);
  if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
  return null;
}

export default function VideoField({
  bucket = "recipe-images",
  folder = "videos",
  value,
  onChange,
  label = "Vídeo (opcional)",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_TTL);
      if (sErr || !signed) throw sErr ?? new Error("No se pudo firmar el vídeo");
      onChange(signed.signedUrl);
      toast.success("Vídeo subido");
    } catch (err: any) {
      toast.error(err.message || "Error al subir vídeo");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const applyLink = () => {
    const url = linkDraft.trim();
    if (!url) return;
    if (!videoEmbedUrl(url)) {
      toast.error("Pega un enlace válido de YouTube o Vimeo");
      return;
    }
    onChange(url);
    setLinkDraft("");
  };

  const clear = () => onChange("");

  const embed = value ? videoEmbedUrl(value) : null;
  const thumb = value ? videoThumbnail(value) : null;
  const uploaded = value ? isUploadedFile(value) : false;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      {value && (
        <div className="rounded-2xl overflow-hidden border border-border bg-black/5 aspect-video">
          {embed ? (
            <iframe src={embed} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" />
          ) : uploaded ? (
            <video src={value} controls preload="metadata" className="w-full h-full" />
          ) : thumb ? (
            <img src={thumb} className="w-full h-full object-cover" />
          ) : (
            <div className="grid place-items-center h-full text-sm muted"><Film className="h-5 w-5 mr-2 inline" /> Vídeo</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" /> {busy ? "Subiendo…" : "Subir vídeo"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          // @ts-ignore — mobile camera capture
          capture="environment"
          hidden
          onChange={handleUpload}
        />
        {value && (
          <button type="button" onClick={clear} className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Quitar
          </button>
        )}
      </div>

      <div className="flex gap-1">
        <input
          className="field flex-1 text-xs"
          placeholder="…o pega enlace de YouTube / Vimeo"
          value={linkDraft}
          onChange={e => setLinkDraft(e.target.value)}
        />
        <button type="button" onClick={applyLink} className="px-3 rounded-full bg-muted text-xs inline-flex items-center gap-1">
          <Link2 className="h-3 w-3" /> Usar
        </button>
      </div>
    </div>
  );
}
