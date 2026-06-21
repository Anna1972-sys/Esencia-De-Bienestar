export type ExtraKey = "menu" | "shopping" | "videos" | "downloads" | "faq";

export const EXTRAS: { key: ExtraKey; icon: string; label: string; short: string }[] = [
  { key: "menu", icon: "🍽️", label: "Menú para los 5 días", short: "Menú" },
  { key: "shopping", icon: "🛒", label: "Lista de la compra", short: "Compra" },
  { key: "videos", icon: "🎥", label: "Vídeos", short: "Vídeos" },
  { key: "downloads", icon: "📚", label: "Material descargable", short: "Material" },
  { key: "faq", icon: "❓", label: "Preguntas frecuentes", short: "FAQ" },
];

export type VideoItem = { kind: "upload" | "youtube" | "vimeo"; url: string };
export type FileItem = { name: string; url: string };
export type Section = { heading?: string; body?: string };
export type ContentBlock = {
  title?: string;
  sections?: Section[];
  images?: string[];
  videos?: VideoItem[];
  files?: FileItem[];
};

export function emptyBlock(): ContentBlock {
  return { title: "", sections: [], images: [], videos: [], files: [] };
}

export function embedUrl(v: VideoItem): string | null {
  if (v.kind === "upload") return null;
  if (v.kind === "youtube") {
    const m = v.url.match(/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  }
  if (v.kind === "vimeo") {
    const m = v.url.match(/vimeo\.com\/(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  }
  return null;
}
