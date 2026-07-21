import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Pencil, ChevronDown, ChevronRight, Save, X, GripVertical, CornerDownRight, Upload } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";

type Category = {
  id: string;
  name: string;
  slug: string | null;
  icon: string | null;
  subtitle: string | null;
  cover_image: string | null;
  parent_id: string | null;
  sort_order: number;
};

type CategoryDraft = {
  name: string;
  icon: string;
  subtitle: string;
  cover_image: string;
};

const EMPTY_DRAFT: CategoryDraft = { name: "", icon: "", subtitle: "", cover_image: "" };

const CONFIRM_DELETE = "¿Eliminar esta categoría? Si tiene subcategorías también se eliminarán. Los recursos quedarán sin categoría.";

type DropTarget =
  | { kind: "row"; id: string; position: "before" | "after" }
  | { kind: "child-of"; parentId: string }
  | { kind: "root-end" };

export default function AdminResourceCategories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT);
  const [creatingFor, setCreatingFor] = useState<string | "root" | null>(null);
  const [newCat, setNewCat] = useState<CategoryDraft>(EMPTY_DRAFT);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<DropTarget | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("resource_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    setCats((data ?? []) as Category[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const tops = cats.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const children = (id: string) =>
    cats.filter(c => c.parent_id === id).sort((a, b) => a.sort_order - b.sort_order);

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const uploadCategoryCover = async (file: File) => {
    const path = `category-covers/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("resource-media").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("resource-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const applyCoverFile = async (file: File, target: "draft" | "new") => {
    try {
      setUploadingCover(true);
      const publicUrl = await uploadCategoryCover(file);
      if (target === "draft") setDraft(prev => ({ ...prev, cover_image: publicUrl }));
      else setNewCat(prev => ({ ...prev, cover_image: publicUrl }));
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo subir la imagen");
    } finally {
      setUploadingCover(false);
    }
  };

  const startEdit = (c: Category) => {
    setEditing(c.id);
    setDraft({
      name: c.name,
      icon: c.icon ?? "",
      subtitle: c.subtitle ?? "",
      cover_image: c.cover_image ?? "",
    });
  };

  const saveEdit = async (id: string) => {
    if (!draft.name.trim()) return;
    const { error } = await supabase
      .from("resource_categories")
      .update({
        name: draft.name.trim(),
        icon: draft.icon.trim() || null,
        subtitle: draft.subtitle.trim() || null,
        cover_image: draft.cover_image.trim() || null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Actualizado"); setEditing(null); load();
  };

  const create = async (parentId: string | null) => {
    if (!newCat.name.trim()) return;
    const siblings = cats.filter(c => c.parent_id === parentId);
    const nextOrder = siblings.length ? Math.max(...siblings.map(s => s.sort_order)) + 1 : 1;
    const { error } = await supabase.from("resource_categories").insert({
      name: newCat.name.trim(),
      icon: newCat.icon.trim() || null,
      subtitle: newCat.subtitle.trim() || null,
      cover_image: newCat.cover_image.trim() || null,
      parent_id: parentId, sort_order: nextOrder,
    });
    if (error) return toast.error(error.message);
    setNewCat(EMPTY_DRAFT); setCreatingFor(null);
    if (parentId) setExpanded(prev => new Set(prev).add(parentId));
    load();
  };

  const del = async (id: string) => {
    if (!confirm(CONFIRM_DELETE)) return;
    const { error } = await supabase.from("resource_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado"); load();
  };

  // Persist ordering for a list of sibling ids (1-based)
  const persistOrder = async (parentId: string | null, orderedIds: string[]) => {
    const updates = orderedIds.map((id, i) => {
      const patch: any = { sort_order: i + 1 };
      if (parentId !== undefined) patch.parent_id = parentId;
      return supabase.from("resource_categories").update(patch).eq("id", id);
    });
    await Promise.all(updates);
  };

  // Apply a drop: move dragId into the position described by target
  const applyDrop = async (target: DropTarget) => {
    if (!dragId) return;
    const dragged = cats.find(c => c.id === dragId);
    if (!dragged) return;

    // Prevent dropping a parent into its own descendants
    const isDescendant = (candidate: string, ancestor: string): boolean => {
      const node = cats.find(c => c.id === candidate);
      if (!node || !node.parent_id) return false;
      if (node.parent_id === ancestor) return true;
      return isDescendant(node.parent_id, ancestor);
    };

    let newParent: string | null;
    let insertIdx: number;

    if (target.kind === "root-end") {
      newParent = null;
      insertIdx = tops.filter(t => t.id !== dragId).length;
    } else if (target.kind === "child-of") {
      if (target.parentId === dragId || isDescendant(target.parentId, dragId)) {
        toast.error("No puedes mover una categoría dentro de sí misma."); return;
      }
      // Only allow one level of nesting: if the dragged has children, block.
      if (children(dragId).length > 0) {
        toast.error("Esta categoría tiene subcategorías. Muévelas primero.");
        return;
      }
      newParent = target.parentId;
      insertIdx = children(target.parentId).filter(c => c.id !== dragId).length;
    } else {
      const targetRow = cats.find(c => c.id === target.id);
      if (!targetRow) return;
      if (target.id === dragId) return;
      if (isDescendant(target.id, dragId)) {
        toast.error("No puedes mover una categoría dentro de sí misma."); return;
      }
      newParent = targetRow.parent_id;
      // If moving INTO a non-root level (target is a sub), we'd nest 2 deep — block if dragged has children
      if (newParent !== null && children(dragId).length > 0) {
        toast.error("Solo se admite un nivel de subcategorías."); return;
      }
      const siblings = cats
        .filter(c => c.parent_id === newParent && c.id !== dragId)
        .sort((a, b) => a.sort_order - b.sort_order);
      const tIdx = siblings.findIndex(s => s.id === target.id);
      insertIdx = target.position === "before" ? tIdx : tIdx + 1;
    }

    const sibs = cats
      .filter(c => c.parent_id === newParent && c.id !== dragId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => c.id);
    sibs.splice(Math.max(0, Math.min(insertIdx, sibs.length)), 0, dragId);

    // Optimistic update locally
    setCats(prev => prev.map(c => {
      if (c.id === dragId) return { ...c, parent_id: newParent, sort_order: sibs.indexOf(dragId) + 1 };
      if (c.parent_id === newParent) {
        const newIdx = sibs.indexOf(c.id);
        return newIdx >= 0 ? { ...c, sort_order: newIdx + 1 } : c;
      }
      return c;
    }));

    // Persist: update dragged with new parent, then renumber siblings
    try {
      await supabase
        .from("resource_categories")
        .update({ parent_id: newParent, sort_order: sibs.indexOf(dragId) + 1 })
        .eq("id", dragId);
      await persistOrder(undefined as any, sibs.filter(id => id !== dragId)
        .map((id) => id)); // renumber others
      // We renumber all siblings cleanly:
      await Promise.all(sibs.map((id, i) =>
        supabase.from("resource_categories").update({ sort_order: i + 1 }).eq("id", id)
      ));
      if (newParent) setExpanded(prev => new Set(prev).add(newParent));
      toast.success("Movido");
    } catch (e: any) {
      toast.error(e.message ?? "Error al mover");
    } finally {
      load();
    }
  };

  // Row-level DnD handlers
  const onDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragEnd = () => { setDragId(null); setDropAt(null); };

  const onRowDragOver = (e: React.DragEvent, id: string) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos: "before" | "after" = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
    setDropAt({ kind: "row", id, position: pos });
  };
  const onRowDrop = (e: React.DragEvent, id: string) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    const target = dropAt ?? { kind: "row" as const, id, position: "after" as const };
    applyDrop(target);
    setDragId(null); setDropAt(null);
  };

  const renderRow = (c: Category, isChild = false) => {
    const subs = children(c.id);
    const isEditing = editing === c.id;
    const isExpanded = expanded.has(c.id);
    const isDragging = dragId === c.id;
    const showBefore = dropAt?.kind === "row" && dropAt.id === c.id && dropAt.position === "before";
    const showAfter = dropAt?.kind === "row" && dropAt.id === c.id && dropAt.position === "after";
    const showChildOf = dropAt?.kind === "child-of" && dropAt.parentId === c.id;

    return (
      <div key={c.id} className={isChild ? "ml-6" : ""}>
        {showBefore && <div className="h-1 my-1 rounded bg-primary" />}
        <div
          draggable={!isEditing}
          onDragStart={(e) => onDragStart(e, c.id)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => onRowDragOver(e, c.id)}
          onDragLeave={() => { if (dropAt && dropAt.kind === "row" && dropAt.id === c.id) setDropAt(null); }}
          onDrop={(e) => onRowDrop(e, c.id)}
          className={`card-soft p-3 flex items-center gap-2 transition ${isDragging ? "opacity-40" : ""}`}
        >
          <GripVertical className="h-4 w-4 muted cursor-grab shrink-0" />
          {!isChild && subs.length > 0 ? (
            <button onClick={() => toggle(c.id)} className="p-1" aria-label="Expandir">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : <div className="w-6" />}
          <div className="text-xl">{c.icon ?? "📁"}</div>
          {isEditing ? (
            <>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="grid grid-cols-[1fr_56px] gap-2">
                  <input className="field" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                  <input className="field text-center" value={draft.icon} placeholder="📁" maxLength={4} onChange={e => setDraft({ ...draft, icon: e.target.value })} />
                </div>
                <input
                  className="field"
                  value={draft.subtitle}
                  placeholder="Subtítulo o descripción"
                  onChange={e => setDraft({ ...draft, subtitle: e.target.value })}
                />
                <div className="flex gap-2">
                  <input
                    className="field flex-1"
                    value={draft.cover_image}
                    placeholder="URL de imagen de portada"
                    onChange={e => setDraft({ ...draft, cover_image: e.target.value })}
                  />
                  <label className="btn-ghost shrink-0 cursor-pointer px-3">
                    <Upload className="h-4 w-4" /> Imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingCover}
                      onChange={e => e.target.files?.[0] && applyCoverFile(e.target.files[0], "draft")}
                    />
                  </label>
                </div>
                {draft.cover_image && (
                  <div className="flex items-center gap-2 rounded-xl bg-primary/5 p-2">
                    <img src={draft.cover_image} alt="" className="h-12 w-16 rounded-lg object-cover" />
                    <button type="button" className="text-xs text-destructive" onClick={() => setDraft(prev => ({ ...prev, cover_image: "" }))}>
                      Quitar imagen
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => saveEdit(c.id)} className="text-primary p-1" aria-label="Guardar"><Save className="h-4 w-4" /></button>
              <button onClick={() => setEditing(null)} className="muted p-1" aria-label="Cancelar"><X className="h-4 w-4" /></button>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{c.name}</div>
                {c.subtitle && <div className="text-xs muted truncate">{c.subtitle}</div>}
              </div>
              <button onClick={() => startEdit(c)} className="text-primary p-1" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => del(c.id)} className="text-destructive p-1" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
            </>
          )}
        </div>
        {showAfter && <div className="h-1 my-1 rounded bg-primary" />}

        {/* "Drop as subcategory" zone (top-level rows only) */}
        {!isChild && dragId && dragId !== c.id && (
          <div
            onDragOver={(e) => {
              if (!dragId || dragId === c.id) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropAt({ kind: "child-of", parentId: c.id });
            }}
            onDragLeave={() => { if (dropAt?.kind === "child-of" && dropAt.parentId === c.id) setDropAt(null); }}
            onDrop={(e) => {
              e.preventDefault();
              applyDrop({ kind: "child-of", parentId: c.id });
              setDragId(null); setDropAt(null);
            }}
            className={`ml-6 mt-1 mb-1 px-3 py-1.5 rounded-lg border-2 border-dashed text-xs muted flex items-center gap-1 ${
              showChildOf ? "border-primary bg-primary/10 text-primary" : "border-border/60"
            }`}
          >
            <CornerDownRight className="h-3 w-3" /> Soltar aquí para convertir en subcategoría de "{c.name}"
          </div>
        )}

        {!isChild && (isExpanded || creatingFor === c.id) && (
          <div className="mt-2 space-y-2 ml-2">
            {subs.map(s => renderRow(s, true))}
            {creatingFor === c.id ? (
              <div className="card-soft p-2 ml-6 flex items-center gap-2">
                <input className="field w-14 text-center" value={newCat.icon} placeholder="📁" maxLength={4} onChange={e => setNewCat({ ...newCat, icon: e.target.value })} />
                <input className="field flex-1" placeholder="Nombre de subcategoría" autoFocus value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} />
                <button onClick={() => create(c.id)} className="btn-primary px-3 py-1.5 text-xs">Crear</button>
                <button onClick={() => { setCreatingFor(null); setNewCat(EMPTY_DRAFT); }} className="muted p-1"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <button onClick={() => setCreatingFor(c.id)} className="btn-ghost text-xs ml-6">
                <Plus className="h-3 w-3" /> Añadir subcategoría
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const showRootDrop = !!dragId;
  const rootHighlighted = dropAt?.kind === "root-end";

  return (
    <div className="pb-28 space-y-3">
      <AdminPageHeader title="Categorías de biblioteca" />
      <p className="text-sm muted">Arrastra <GripVertical className="inline h-3 w-3 align-middle" /> para reordenar o mover entre carpetas. También puedes soltar sobre una categoría para convertir un elemento en subcategoría.</p>


      {loading ? (
        <div className="muted">Cargando…</div>
      ) : (
        <div className="space-y-2">
          {tops.map(c => renderRow(c))}

          {showRootDrop && (
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropAt({ kind: "root-end" }); }}
              onDragLeave={() => { if (dropAt?.kind === "root-end") setDropAt(null); }}
              onDrop={(e) => { e.preventDefault(); applyDrop({ kind: "root-end" }); setDragId(null); setDropAt(null); }}
              className={`mt-2 px-3 py-3 rounded-xl border-2 border-dashed text-center text-xs ${
                rootHighlighted ? "border-primary bg-primary/10 text-primary" : "border-border/60 muted"
              }`}
            >
              Soltar aquí para mover a la raíz (categoría principal)
            </div>
          )}
        </div>
      )}

      {creatingFor === "root" ? (
        <div className="card-soft p-2 flex items-center gap-2">
          <input className="field w-14 text-center" value={newCat.icon} placeholder="📁" maxLength={4} onChange={e => setNewCat({ ...newCat, icon: e.target.value })} />
          <input className="field flex-1" placeholder="Nombre de la categoría" autoFocus value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} />
          <button onClick={() => create(null)} className="btn-primary px-3 py-1.5 text-xs">Crear</button>
          <button onClick={() => { setCreatingFor(null); setNewCat(EMPTY_DRAFT); }} className="muted p-1"><X className="h-4 w-4" /></button>
        </div>
      ) : (
        <button onClick={() => setCreatingFor("root")} className="btn-primary w-full">
          <Plus className="h-4 w-4" /> Nueva categoría principal
        </button>
      )}
    </div>
  );
}
