import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronRight, BookOpen, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { mediaUrl } from "@/lib/mediaStorage";

export type LibraryCategory = {
  id?: string;
  key: string;
  label: string;
  emoji?: string | null;
  image?: string;
  subtitle?: string | null;
  visible?: boolean | null;
};

type Props = {
  table: string;
  basePath: string;
  title: string;
  subtitle: string;
  categories: readonly LibraryCategory[];
  variant?: "default" | "nutrition" | "movement";
  hero?: ReactNode;
  visibleOnly?: boolean;
};

function blocksToText(blocks: any): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b) => {
      if (!b) return "";
      if (b.type === "title" || b.type === "subtitle" || b.type === "text") return b.value ?? "";
      if (b.type === "link" || b.type === "button") return b.label ?? "";
      if (b.type === "image" || b.type === "video") return b.caption ?? "";
      return "";
    })
    .join(" ")
    .toLowerCase();
}

function firstMediaFromBlocks(blocks: any): string | null {
  if (!Array.isArray(blocks)) return null;
  const media = blocks.find((b) => b?.type === "image" && b.url) ?? blocks.find((b) => b?.type === "video" && b.url);
  return media?.url ?? null;
}

function normalizeKey(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function firstTextFromBlocks(blocks: any): string {
  if (!Array.isArray(blocks)) return "";
  const textBlock = blocks.find((b) => b?.type === "text" && b.value);
  return textBlock?.value ?? "";
}

function shortText(value?: string | null, max = 120) {
  const text = (value ?? "").toString().replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

export default function LibraryPage({ table, basePath, title, subtitle, categories, variant = "default", hero, visibleOnly = false }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (supabase as any)
      .from(table)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .then(({ data }: any) => {
        const rows = data ?? [];
        setItems(visibleOnly ? rows.filter((item: any) => item.visible !== false) : rows);
      });
  }, [table, visibleOnly]);

  const term = String(q ?? "").trim().toLowerCase();
  const matches = (it: any) => {
    if (!term) return true;
    const tags = (it.tags ?? []).map((t: string) => String(t ?? "").toLowerCase()).join(" ");
    return (
      String(it.title ?? "").toLowerCase().includes(term) ||
      tags.includes(term) ||
      blocksToText(it.blocks).includes(term)
    );
  };

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.visible !== false),
    [categories]
  );

  const categoryMatches = (item: any, category: LibraryCategory) => {
    const itemCategory = normalizeKey(item.category);
    const itemCategoryId = item.category_id ? String(item.category_id) : "";
    const candidates = [
      category.id,
      category.key,
      category.label,
      normalizeKey(category.key),
      normalizeKey(category.label),
    ].filter(Boolean).map((value) => String(value));

    return candidates.some((candidate) => (
      itemCategoryId === candidate ||
      item.category === candidate ||
      itemCategory === normalizeKey(candidate)
    ));
  };

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const category of visibleCategories) {
      m[category.key] = items.filter((item) => categoryMatches(item, category)).length;
    }
    return m;
  }, [items, visibleCategories]);

  const current = cat ? visibleCategories.find((c) => c.key === cat) ?? null : null;
  const filtered = current ? items.filter((i) => categoryMatches(i, current) && matches(i)) : [];
  const globalResults = !cat && term ? items.filter(matches) : [];

  const SearchBar = (
    <div className="relative mb-4">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por título, contenido o etiqueta…"
        className="field pl-9 pr-9 w-full"
      />
      {q && (
        <button
          onClick={() => setQ("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 muted"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const Card = ({ it, label }: { it: any; label?: string }) => {
    const cover = it.cover_image || it.cover_image_url || it.image_url || firstMediaFromBlocks(it.blocks);
    const cardTitle = it.title || it.name || "Publicación sin título";
    const cardDescription = shortText(it.subtitle || it.description || firstTextFromBlocks(it.blocks) || "Abre la publicación para ver todo el contenido.");
    const date = it.created_at ? new Date(it.created_at).toLocaleDateString("es-ES") : "";
    return (
      <Link
        to={`${basePath}/${it.id}`}
        className="card-soft overflow-hidden block hover:shadow-glow transition"
      >
        {cover ? (
          <img src={mediaUrl(cover)} alt="" className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-[#FFF7FA] to-[#F7D8EA] grid place-items-center text-primary text-sm font-medium">
            Sin imagen
          </div>
        )}
        <div className="p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium leading-tight">{cardTitle}</div>
            <div className="text-xs muted mt-1">{label ?? visibleCategories.find((c) => categoryMatches(it, c))?.label}</div>
            {cardDescription && <p className="text-sm muted mt-2 line-clamp-2">{cardDescription}</p>}
            {date && <div className="text-[11px] muted mt-2">{date}</div>}
            {Array.isArray(it.tags) && it.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {it.tags.slice(0, 4).map((t: string) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <span className="btn-secondary mt-3 inline-flex text-xs px-3 py-1.5">Abrir publicación</span>
          </div>
          <ChevronRight className="h-4 w-4 muted shrink-0 mt-1" />
        </div>
      </Link>
    );
  };

  return (
    <div className={`pb-8 ${variant === "nutrition" ? "wellness-nutrition p-5 -mx-1" : ""}`}>
      {cat ? (
        <>
          <button onClick={() => setCat(null)} className="text-sm muted inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="h-4 w-4" /> Categorías
          </button>
          <h1 className="heading-lg mb-1">
            {(variant === "nutrition" || variant === "movement") && current?.image
              ? current.label
              : `${current?.emoji ?? ""} ${current?.label ?? ""}`}
          </h1>
          <p className="text-sm muted mb-4">
            {filtered.length} publicación{filtered.length === 1 ? "" : "es"}
          </p>
          {SearchBar}
          {filtered.length === 0 ? (
            <div className="card-soft p-6 text-center muted">
              {term
                ? "No hemos encontrado publicaciones con esa búsqueda."
                : "Próximamente añadiremos contenido en esta categoría."}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((it) => <Card key={it.id} it={it} label={current?.label} />)}
            </div>
          )}
        </>
      ) : (
        <>
          <BackButton fallbackTo="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="h-4 w-4" /> Volver
          </BackButton>
          {hero}
          <h1 className="heading-lg mb-1">{title}</h1>
          <p className="text-sm muted mb-4">{subtitle}</p>
          {SearchBar}
          {term ? (
            globalResults.length === 0 ? (
              <div className="card-soft p-6 text-center muted">
                No hemos encontrado publicaciones con esa búsqueda.
              </div>
            ) : (
              <div className="space-y-3">
                {globalResults.map((it) => <Card key={it.id} it={it} />)}
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {visibleCategories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCat(c.key)}
                  className={variant === "nutrition" ? "nutrition-category-card text-left hover:shadow-glow transition" : "card-soft p-4 text-left hover:shadow-glow transition"}
                >
                  {(variant === "nutrition" || variant === "movement") && c.image ? (
                    <div className="nutrition-category-image mb-3 overflow-hidden rounded-2xl">
                      <img src={mediaUrl(c.image)} alt="" loading="lazy" className="h-28 w-full object-cover" />
                    </div>
                  ) : (
                    <div className="text-2xl mb-1">{c.emoji}</div>
                  )}
                  <div className="font-medium text-sm">{c.label}</div>
                  {c.subtitle && <div className="text-xs mt-1 nutrition-category-subtitle">{c.subtitle}</div>}
                  <div className="text-xs muted mt-1 inline-flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> {counts[c.key] ?? 0}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
