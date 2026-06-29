import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import {
  Plus, Trash2, Image as ImageIcon, Video, FileText, Type,
  ArrowUp, ArrowDown, Upload, Pencil, Link as LinkIcon, MousePointerClick, Heading, Heading2,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";
import type { ContentBlock } from "@/lib/movementCategories";
import type { LibraryCategory } from "./LibraryPage";
import { numberInputValue, numberOrFallback, type AdminNumberValue } from "@/lib/adminNumberInput";

const CONFIRM_DELETE = "¿Estás segura de que deseas eliminar este elemento? Esta acción no se puede deshacer.";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days; resign on read for longer access

type Form = {
  id?: string;
  title: string;
  subtitle: string;
  category: string;
  cover_image: string;
  blocks: ContentBlock[];
  sort_order: AdminNumberValue;
  tags: string[];
  visible: boolean;
};

const TAG_SUGGESTIONS = [
  "Principiantes", "Caminar", "Fuerza", "Cardio", "Movilidad", "Estiramientos",
  "Proteínas", "Hidratación", "Descanso", "Recuperación", "Pérdida de peso", "Recetas",
];

type Props = {
  table: string;
  storageFolder: string;          // e.g. "movement" or "nutrition"
  backTo: string;                 // e.g. "/app/admin"
  title: string;                  // page heading
  categories: readonly LibraryCategory[];
  className?: string;
  enableVisibility?: boolean;
  enableSubtitle?: boolean;
  quickSections?: readonly string[];
};

async function uploadFile(file: File, folder: string, base: string) {
  const path = `${base}/${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("resource-media").upload(path, file);
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage.from("resource-media").createSignedUrl(path, SIGNED_TTL);
  if (sErr) throw sErr;
  return data.signedUrl;
}

export default function LibraryAdminPage({
  table,
  storageFolder,
  backTo,
  title,
  categories,
  className = "",
  enableVisibility = false,
  enableSubtitle = false,
  quickSections = [],
}: Props) {
  const empty: Form = {
    title: "",
    subtitle: "",
    category: categories[0]?.key ?? "",
    cover_image: "",
    blocks: [],
    sort_order: 0,
    tags: [],
    visible: true,
  };
  const [items, setItems] = useState<any[]>([]);
  const [f, setF] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);

  const load = () =>
    (supabase as any)
      .from(table)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .then(({ data }: any) => setItems(data ?? []));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [table]);

  const reset = () => setF(empty);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    setBusy(true);
    const payload: any = {
      title: f.title,
      ...(enableSubtitle ? { subtitle: f.subtitle || null } : {}),
      category: f.category,
      cover_image: f.cover_image || null,
      blocks: f.blocks,
      sort_order: numberOrFallback(f.sort_order),
      tags: f.tags ?? [],
      ...(enableVisibility ? { visible: f.visible } : {}),
    };
    const res = f.id
      ? await (supabase as any).from(table).update(payload).eq("id", f.id)
      : await (supabase as any).from(table).insert(payload);
    setBusy(false);
    if (res.error) toast.error(res.error.message);
    else { reset(); load(); toast.success("Guardado"); }
  };

  const del = async (id: string) => {
    if (!confirm(CONFIRM_DELETE)) return;
    await (supabase as any).from(table).delete().eq("id", id);
    if (f.id === id) reset();
    load();
  };

  const moveItem = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex(i => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return;
    const a = items[idx], b = items[j];
    const aOrder = a.sort_order ?? 0, bOrder = b.sort_order ?? 0;
    await (supabase as any).from(table).update({ sort_order: bOrder }).eq("id", a.id);
    await (supabase as any).from(table).update({ sort_order: aOrder }).eq("id", b.id);
    load();
  };

  const edit = (it: any) => {
    setF({
      id: it.id,
      title: it.title ?? "",
      subtitle: it.subtitle ?? "",
      category: it.category ?? categories[0].key,
      cover_image: it.cover_image ?? "",
      blocks: Array.isArray(it.blocks) ? it.blocks : [],
      sort_order: it.sort_order ?? 0,
      tags: Array.isArray(it.tags) ? it.tags : [],
      visible: it.visible !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onCover = async (file: File) => {
    try { setBusy(true); const url = await uploadFile(file, "covers", storageFolder); setF(s => ({ ...s, cover_image: url })); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const addBlock = (b: ContentBlock) => setF(s => ({ ...s, blocks: [...s.blocks, b] }));
  const addQuickSection = (label: string) => setF(s => ({
    ...s,
    blocks: [
      ...s.blocks,
      { type: "title", value: label },
      { type: "text", value: "" },
    ],
  }));
  const updateBlock = (i: number, patch: any) => setF(s => ({ ...s, blocks: s.blocks.map((b, idx) => idx === i ? { ...b, ...patch } : b) }));
  const removeBlock = (i: number) => setF(s => ({ ...s, blocks: s.blocks.filter((_, idx) => idx !== i) }));
  const moveBlock = (i: number, dir: -1 | 1) => setF(s => {
    const j = i + dir; if (j < 0 || j >= s.blocks.length) return s;
    const next = [...s.blocks]; [next[i], next[j]] = [next[j], next[i]]; return { ...s, blocks: next };
  });

  const uploadBlock = async (kind: "image" | "video" | "pdf", file: File) => {
    try {
      setBusy(true);
      const url = await uploadFile(file, kind, storageFolder);
      if (kind === "image") addBlock({ type: "image", url });
      else if (kind === "video") addBlock({ type: "video", url });
      else addBlock({ type: "pdf", url, name: file.name });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className={`pb-28 ${className}`}>
      <AdminPageHeader title={title} backTo={backTo} />


      <form onSubmit={save} className="card-soft library-admin-container p-4 space-y-3 mb-5">
        <div className="font-medium">{f.id ? "Editar publicación" : "Nueva publicación"}</div>

        <div>
          <label className="text-xs muted">Imagen principal de portada</label>
          {f.cover_image && <img src={f.cover_image} alt="" className="w-full h-40 object-cover rounded-xl mt-1 mb-2" />}
          <label className="btn-secondary inline-flex cursor-pointer">
            <Upload className="h-4 w-4" /> {f.cover_image ? "Cambiar" : "Subir"} portada
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onCover(e.target.files[0])} />
          </label>
        </div>

        <input className="field" placeholder="Título" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} required />

        {enableSubtitle && (
          <input
            className="field"
            placeholder="Subtítulo breve"
            value={f.subtitle}
            onChange={e => setF({ ...f, subtitle: e.target.value })}
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <select className="field" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
            {categories.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
          </select>
          <input className="field" type="number" placeholder="Orden" value={f.sort_order} onChange={e => setF({ ...f, sort_order: numberInputValue(e.target.value) })} />
        </div>

        {enableVisibility && (
          <label className="flex items-center justify-between rounded-xl border border-[#FF2D95]/40 bg-white px-3 py-2 text-sm">
            <span>Visible para clientes</span>
            <input
              type="checkbox"
              checked={f.visible}
              onChange={e => setF({ ...f, visible: e.target.checked })}
            />
          </label>
        )}

        <div>
          <label className="text-xs muted">Etiquetas</label>
          {f.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 mb-2">
              {f.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                  {t}
                  <button type="button" onClick={() => setF(s => ({ ...s, tags: s.tags.filter(x => x !== t) }))} aria-label={`Quitar ${t}`}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            className="field"
            placeholder="Escribe una etiqueta y pulsa Enter"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = (e.target as HTMLInputElement).value.trim();
                if (v && !f.tags.includes(v)) setF(s => ({ ...s, tags: [...s.tags, v] }));
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {TAG_SUGGESTIONS.filter(t => !f.tags.includes(t)).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setF(s => ({ ...s, tags: [...s.tags, t] }))}
                className="text-[11px] px-2 py-0.5 rounded-full border border-border muted hover:bg-secondary"
              >
                + {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs muted mb-2">Contenido (se mostrará en el mismo orden)</div>
          <div className="space-y-2">
            {f.blocks.map((b, i) => (
              <div key={i} className="library-admin-inner-container border rounded-xl p-2 bg-background">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs muted uppercase">{b.type}</div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moveBlock(i, -1)} className="p-1" aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moveBlock(i, 1)} className="p-1" aria-label="Bajar"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => removeBlock(i)} className="p-1 text-destructive" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {b.type === "title" && (
                  <input className="field" placeholder="Título de sección" value={(b as any).value} onChange={e => updateBlock(i, { value: e.target.value })} />
                )}
                {b.type === "subtitle" && (
                  <input className="field" placeholder="Subtítulo" value={(b as any).value} onChange={e => updateBlock(i, { value: e.target.value })} />
                )}
                {b.type === "text" && (
                  <textarea className="field min-h-24" placeholder="Texto…" value={(b as any).value} onChange={e => updateBlock(i, { value: e.target.value })} />
                )}
                {b.type === "image" && (
                  <>
                    <img src={(b as any).url} alt="" className="w-full max-h-48 object-cover rounded-lg" />
                    <input className="field mt-2" placeholder="Pie de imagen (opcional)" value={(b as any).caption ?? ""} onChange={e => updateBlock(i, { caption: e.target.value })} />
                  </>
                )}
                {b.type === "video" && (
                  <>
                    <input className="field" placeholder="URL del vídeo" value={(b as any).url} onChange={e => updateBlock(i, { url: e.target.value })} />
                    <input className="field mt-2" placeholder="Descripción (opcional)" value={(b as any).caption ?? ""} onChange={e => updateBlock(i, { caption: e.target.value })} />
                  </>
                )}
                {b.type === "pdf" && (
                  <div className="text-sm truncate"><a className="text-primary underline" href={(b as any).url} target="_blank" rel="noreferrer">{(b as any).name ?? "Archivo"}</a></div>
                )}
                {(b.type === "link" || b.type === "button") && (
                  <div className="grid gap-2">
                    <input className="field" placeholder="Texto visible" value={(b as any).label} onChange={e => updateBlock(i, { label: e.target.value })} />
                    <input className="field" placeholder="URL de destino (https://…)" value={(b as any).url} onChange={e => updateBlock(i, { url: e.target.value })} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            {quickSections.map((label) => (
              <button key={label} type="button" className="btn-secondary" onClick={() => addQuickSection(label)}>
                <Type className="h-4 w-4" /> {label}
              </button>
            ))}
            <button type="button" className="btn-secondary" onClick={() => addBlock({ type: "title", value: "" })}><Heading className="h-4 w-4" /> Título</button>
            <button type="button" className="btn-secondary" onClick={() => addBlock({ type: "subtitle", value: "" })}><Heading2 className="h-4 w-4" /> Subtítulo</button>
            <button type="button" className="btn-secondary" onClick={() => addBlock({ type: "text", value: "" })}><Type className="h-4 w-4" /> Texto</button>
            <label className="btn-secondary cursor-pointer">
              <ImageIcon className="h-4 w-4" /> Imagen
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadBlock("image", e.target.files[0])} />
            </label>
            <label className="btn-secondary cursor-pointer">
              <Video className="h-4 w-4" /> Vídeo (archivo)
              <input type="file" accept="video/*" className="hidden" onChange={e => e.target.files?.[0] && uploadBlock("video", e.target.files[0])} />
            </label>
            <button type="button" className="btn-secondary" onClick={() => addBlock({ type: "video", url: "" })}><Video className="h-4 w-4" /> Vídeo (URL)</button>
            <label className="btn-secondary cursor-pointer">
              <FileText className="h-4 w-4" /> Archivo / PDF
              <input type="file" className="hidden" onChange={e => e.target.files?.[0] && uploadBlock("pdf", e.target.files[0])} />
            </label>
            <button type="button" className="btn-secondary" onClick={() => addBlock({ type: "link", label: "", url: "" })}><LinkIcon className="h-4 w-4" /> Enlace</button>
            <button type="button" className="btn-secondary" onClick={() => addBlock({ type: "button", label: "", url: "" })}><MousePointerClick className="h-4 w-4" /> Botón</button>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy}><Plus className="h-4 w-4" /> {f.id ? "Guardar cambios" : "Publicar"}</button>
          {f.id && <button type="button" className="btn-secondary" onClick={reset}>Cancelar</button>}
        </div>
      </form>

      <div className="space-y-2">{items.map(i => (
        <div key={i.id} className="card-soft library-admin-container p-3 flex items-center justify-between gap-2">
          {i.cover_image && <img src={i.cover_image} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{i.title}</div>
            <div className="text-xs muted truncate">
              {categories.find(c => c.key === i.category)?.label ?? i.category ?? "Sin categoría"}
              {enableVisibility && i.visible === false ? " · Oculto" : ""}
            </div>
          </div>
          <button onClick={() => moveItem(i.id, -1)} className="shrink-0 p-1" aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
          <button onClick={() => moveItem(i.id, 1)} className="shrink-0 p-1" aria-label="Bajar"><ArrowDown className="h-4 w-4" /></button>
          <button onClick={() => edit(i)} className="text-primary shrink-0 p-1" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => del(i.id)} className="text-destructive shrink-0 p-1" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}</div>
    </div>
  );
}
