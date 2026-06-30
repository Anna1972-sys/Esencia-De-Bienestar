import { useRef, useState } from "react";
import { Film, Link2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { mediaUrl, uploadMediaToStorage, videoEmbedUrlFromMedia, videoThumbnailFromMedia } from "@/lib/mediaStorage";

type Props = {
  /** Storage bucket. Must enforce admin-only writes via RLS. */
  bucket?: string;
  /** Folder/prefix inside the bucket. */
  folder?: string;
  /** Current value (stable Storage reference OR external video URL). */
  value: string;
  onChange: (url: string) => void;
  label?: string;
};

function isUploadedFile(url: string) {
  return /\/storage\/v1\/object\//.test(url) || /^storage:\/\//.test(url) || /^blob:/.test(url);
}
export function videoEmbedUrl(url: string): string | null {
  return videoEmbedUrlFromMedia(url);
}
export function videoThumbnail(url: string): string | null {
  return videoThumbnailFromMedia(url);
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
      const ref = await uploadMediaToStorage(bucket, folder, file);
      onChange(ref);
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
            <video src={mediaUrl(value)} controls preload="metadata" className="w-full h-full" />
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
