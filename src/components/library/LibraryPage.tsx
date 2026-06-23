import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronRight, BookOpen, Search, X } from "lucide-react";
import type { ReactNode } from "react";

export type LibraryCategory = { key: string; label: string; emoji: string };

type Props = {
  table: string;
  basePath: string;
  title: string;
  subtitle: string;
  categories: readonly LibraryCategory[];
  variant?: "default" | "nutrition";
  hero?: ReactNode;
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

export default function LibraryPage({ table, basePath, title, subtitle, categories, variant = "default", hero }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (supabase as any)
      .from(table)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .then(({ data }: any) => setItems(data ?? []));
  }, [table]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) if (i.category) m[i.category] = (m[i.category] ?? 0) + 1;
    return m;
  }, [items]);

  const term = q.trim().toLowerCase();
  const matches = (it: any) => {
    if (!term) return true;
    const tags = (it.tags ?? []).map((t: string) => t.toLowerCase()).join(" ");
    return (
      (it.title ?? "").toLowerCase().includes(term) ||
      tags.includes(term) ||
      blocksToText(it.blocks).includes(term)
    );
  };

  const filtered = cat ? items.filter((i) => i.category === cat && matches(i)) : [];
  const globalResults = !cat && term ? items.filter(matches) : [];
  const current = cat ? categories.find((c) => c.key === cat) ?? null : null;

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

  const Card = ({ it, label }: { it: any; label?: string }) => (
    <Link
      to={`${basePath}/${it.id}`}
      className="card-soft overflow-hidden block hover:shadow-glow transition"
    >
      {it.cover_image && <img src={it.cover_image} alt="" className="w-full h-40 object-cover" />}
      <div className="p-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{it.title}</div>
          <div className="text-xs muted truncate">{label ?? categories.find((c) => c.key === it.category)?.label}</div>
          {Array.isArray(it.tags) && it.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {it.tags.slice(0, 4).map((t: string) => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 muted shrink-0" />
      </div>
    </Link>
  );

  return (
    <div className={`pb-8 ${variant === "nutrition" ? "wellness-nutrition p-5 -mx-1" : ""}`}>
      {cat ? (
        <>
          <button onClick={() => setCat(null)} className="text-sm muted inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="h-4 w-4" /> Categorías
          </button>
          <h1 className="heading-lg mb-1">
            {current?.emoji} {current?.label}
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
          <Link to="/app" className="text-sm muted inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
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
              {categories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCat(c.key)}
                  className="card-soft p-4 text-left hover:shadow-glow transition"
                >
                  <div className="text-2xl mb-1">{c.emoji}</div>
                  <div className="font-medium text-sm">{c.label}</div>
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
