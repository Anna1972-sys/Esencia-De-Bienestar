import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { numberInputValue, numberOrFallback } from "@/lib/adminNumberInput";

export type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "checkbox";
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
};

type Props = {
  table: string;
  title: string;
  subtitle: string;
  fields: Field[];
  primaryField: string;
  secondaryField?: string;
  defaults?: Record<string, any>;
};

export default function SimpleListAdmin({ table, title, subtitle, fields, primaryField, secondaryField, defaults = {} }: Props) {
  const blank: Record<string, any> = { sort_order: 0, ...defaults, ...Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? false : f.type === "number" ? 0 : ""])) };
  const [items, setItems] = useState<any[]>([]);
  const [f, setF] = useState<any>({ ...blank });
  const [busy, setBusy] = useState(false);

  const load = () =>
    (supabase as any)
      .from(table)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .then(({ data }: any) => setItems(data ?? []));

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [table]);

  const reset = () => setF({ ...blank });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = { ...f };
    for (const field of fields) {
      if (field.type === "number") payload[field.key] = numberOrFallback(payload[field.key]);
    }
    payload.sort_order = numberOrFallback(payload.sort_order);
    const { id, ...rest } = payload;
    const res = id
      ? await (supabase as any).from(table).update(rest).eq("id", id)
      : await (supabase as any).from(table).insert(rest);
    setBusy(false);
    if (res.error) toast.error(res.error.message);
    else { reset(); load(); toast.success("Guardado"); }
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar este elemento?")) return;
    await (supabase as any).from(table).delete().eq("id", id);
    if (f.id === id) reset();
    load();
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return;
    const a = items[idx], b = items[j];
    await (supabase as any).from(table).update({ sort_order: b.sort_order ?? 0 }).eq("id", a.id);
    await (supabase as any).from(table).update({ sort_order: a.sort_order ?? 0 }).eq("id", b.id);
    load();
  };

  const edit = (it: any) => { setF({ ...blank, ...it }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="pb-28 max-w-3xl mx-auto">
      <AdminPageHeader title={title} subtitle={subtitle} />


      <form onSubmit={save} className="card-soft p-4 space-y-3 mb-5">
        <div className="font-medium">{f.id ? "Editar elemento" : "Nuevo elemento"}</div>
        {fields.map((field) => (
          <div key={field.key}>
            <label className="text-xs muted">{field.label}</label>
            {field.type === "textarea" ? (
              <textarea className="field min-h-20" placeholder={field.placeholder} value={f[field.key] ?? ""} onChange={(e) => setF({ ...f, [field.key]: e.target.value })} required={field.required} />
            ) : field.type === "select" ? (
              <select className="field" value={f[field.key] ?? ""} onChange={(e) => setF({ ...f, [field.key]: e.target.value })}>
                {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : field.type === "checkbox" ? (
              <div className="flex items-center gap-2 mt-1">
                <input id={field.key} type="checkbox" checked={!!f[field.key]} onChange={(e) => setF({ ...f, [field.key]: e.target.checked })} />
                <label htmlFor={field.key} className="text-sm">{field.placeholder ?? "Activado"}</label>
              </div>
            ) : (
              <input className="field" type={field.type === "number" ? "number" : "text"} placeholder={field.placeholder} value={f[field.key] ?? ""} onChange={(e) => setF({ ...f, [field.key]: field.type === "number" ? numberInputValue(e.target.value) : e.target.value })} required={field.required} />
            )}
          </div>
        ))}
        <div>
          <label className="text-xs muted">Orden</label>
          <input className="field" type="number" value={f.sort_order ?? 0} onChange={(e) => setF({ ...f, sort_order: numberInputValue(e.target.value) })} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy}><Plus className="h-4 w-4" /> {f.id ? "Guardar" : "Añadir"}</button>
          {f.id && <button type="button" className="btn-secondary" onClick={reset}>Cancelar</button>}
        </div>
      </form>

      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="card-soft p-3 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{it[primaryField]}</div>
              {secondaryField && it[secondaryField] && <div className="text-xs muted truncate">{it[secondaryField]}</div>}
            </div>
            <button onClick={() => move(it.id, -1)} className="p-1 shrink-0" aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
            <button onClick={() => move(it.id, 1)} className="p-1 shrink-0" aria-label="Bajar"><ArrowDown className="h-4 w-4" /></button>
            <button onClick={() => edit(it)} className="p-1 text-primary shrink-0" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => del(it.id)} className="p-1 text-destructive shrink-0" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {items.length === 0 && <div className="card-soft p-6 text-center muted">Aún no hay elementos.</div>}
      </div>
    </div>
  );
}
