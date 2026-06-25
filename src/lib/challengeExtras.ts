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
export type ContentItem =
  | { id: string; type: "text"; title?: string; body?: string }
  | { id: string; type: "image"; url: string; title?: string }
  | { id: string; type: "video"; video: VideoItem; title?: string }
  | { id: string; type: "file"; file: FileItem; title?: string }
  | { id: string; type: "link"; url: string; title?: string; description?: string };
export type ContentBlock = {
  title?: string;
  blocks?: ContentItem[];
  sections?: Section[];
  images?: string[];
  videos?: VideoItem[];
  files?: FileItem[];
};

export function emptyBlock(): ContentBlock {
  return { title: "", blocks: [], sections: [], images: [], videos: [], files: [] };
}

export function legacyItems(block: ContentBlock): ContentItem[] {
  const items: ContentItem[] = [];
  (block.sections ?? []).forEach((section, index) => items.push({ id: `text-${index}`, type: "text", title: section.heading, body: section.body }));
  (block.images ?? []).forEach((url, index) => items.push({ id: `image-${index}`, type: "image", url }));
  (block.videos ?? []).forEach((video, index) => items.push({ id: `video-${index}`, type: "video", video }));
  (block.files ?? []).forEach((file, index) => items.push({ id: `file-${index}`, type: "file", file }));
  return items;
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
