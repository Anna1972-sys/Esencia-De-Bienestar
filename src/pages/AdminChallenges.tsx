import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Pencil, X } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { toast } from "sonner";
import ChallengeBlockEditor from "@/components/ChallengeBlockEditor";
import { EXTRAS, ExtraKey, ContentBlock, emptyBlock, legacyItems } from "@/lib/challengeExtras";
import { useFormDraft } from "@/hooks/useFormDraft";
import DraftBanner from "@/components/DraftBanner";

const CONFIRM_DELETE = "¿Estás segura de que deseas eliminar este elemento? Esta acción no se puede deshacer.";

type DayForm = ContentBlock & { day: number };
type ExtrasMap = Record<ExtraKey, ContentBlock>;

type ChForm = {
  title: string;
  description: string;
  icon: string;
  days: DayForm[];
  extras: ExtrasMap;
};

const emptyDay = (n: number): DayForm => ({ day: n, ...emptyBlock() });
const emptyExtras = (): ExtrasMap => EXTRAS.reduce((acc, e) => {
  acc[e.key] = emptyBlock(); return acc;
}, {} as ExtrasMap);
const emptyForm = (): ChForm => ({
  title: "", description: "", icon: "🌸",
  days: [1, 2, 3, 4, 5].map(emptyDay),
  extras: emptyExtras(),
});

export default function AdminChallenges() {
  const [items, setItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { value: f, setValue: setF, clearDraft, hasDraft } = useFormDraft<ChForm>("admin-challenges-new", emptyForm(), !editingId);
  const [openTab, setOpenTab] = useState<string>("d1");

  const load = () => supabase.from("challenges").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);

  const resetForm = () => { setF(emptyForm()); setEditingId(null); setOpenTab("d1"); clearDraft(); };

  const normalizeBlock = (b: ContentBlock): ContentBlock => ({
    title: b.title?.trim() || undefined,
    blocks: (b.blocks ?? []).filter(item => {
      if (item.type === "text") return Boolean(item.title?.trim() || item.body?.trim());
      if (item.type === "link") return Boolean(item.url?.trim());
      return true;
    }),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) { toast.error("Añade el título del reto"); return; }
    const days = f.days.map(d => ({ day: d.day, ...normalizeBlock(d) }));
    const extras = EXTRAS.reduce((acc, m) => {
      acc[m.key] = normalizeBlock(f.extras[m.key] ?? emptyBlock());
      return acc;
    }, {} as ExtrasMap);
    const payload = { title: f.title, description: f.description, icon: f.icon || null, days, extras };
    const { error } = editingId
      ? await supabase.from("challenges").update(payload).eq("id", editingId)
      : await supabase.from("challenges").insert(payload);
    if (error) toast.error(error.message);
    else { resetForm(); load(); toast.success(editingId ? "Reto actualizado" : "Reto creado"); }
  };

  const startEdit = (c: any) => {
    setEditingId(c.id);
    const rawDays: any[] = Array.isArray(c.days) ? c.days : [];
    const days = [1, 2, 3, 4, 5].map(n => {
      const d = rawDays.find((x: any) => x.day === n) ?? {};
      return {
        day: n,
        title: d.title ?? "",
        blocks: Array.isArray(d.blocks) ? d.blocks : legacyItems(d),
      };
    });
    const rawExtras = (c.extras ?? {}) as Record<string, any>;
    const extras = EXTRAS.reduce((acc, m) => {
      const x = rawExtras[m.key] ?? {};
      acc[m.key] = {
        title: x.title ?? "",
        blocks: Array.isArray(x.blocks) ? x.blocks : legacyItems(x),
      };
      return acc;
    }, {} as ExtrasMap);
    setF({ title: c.title ?? "", description: c.description ?? "", icon: c.icon ?? "🌸", days, extras });
    setOpenTab("d1");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (id: string) => {
    if (!confirm(CONFIRM_DELETE)) return;
    await supabase.from("challenges").delete().eq("id", id);
    if (editingId === id) resetForm();
    load();
  };

  const updateDay = (idx: number, patch: Partial<ContentBlock>) => {
    setF(prev => ({ ...prev, days: prev.days.map((d, i) => i === idx ? { ...d, ...patch } : d) }));
  };
  const updateExtra = (key: ExtraKey, patch: Partial<ContentBlock>) => {
    setF(prev => ({ ...prev, extras: { ...prev.extras, [key]: { ...prev.extras[key], ...patch } } }));
  };

  const tabs = [
    ...f.days.map(d => ({ id: `d${d.day}`, label: `📅 Día ${d.day}` })),
    ...EXTRAS.map(e => ({ id: `x-${e.key}`, label: `${e.icon} ${e.short}` })),
  ];

  return (
    <div className="pb-28 space-y-4">
      <AdminPageHeader title="Retos de 5 días" subtitle="Crear y editar retos" />


      {!editingId && hasDraft && <DraftBanner onDiscard={() => { clearDraft(); setF(emptyForm()); }} />}
      <form onSubmit={submit} className="card-elegant p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-serif text-lg" style={{ color: "hsl(var(--plum))" }}>{editingId ? "Editar reto" : "Nuevo reto"}</div>
          {editingId && <button type="button" onClick={resetForm} className="text-xs muted inline-flex items-center gap-1"><X className="h-3 w-3" /> Cancelar</button>}
        </div>

        <div className="flex gap-2">
          <input className="field w-20 text-center text-2xl" placeholder="🌸" value={f.icon} onChange={e => setF({ ...f, icon: e.target.value })} maxLength={4} />
          <input className="field flex-1" placeholder="Título del reto" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} required />
        </div>
        <textarea className="field min-h-20" placeholder="Descripción general del reto (opcional)" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpenTab(t.id)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition ${
                openTab === t.id ? "text-white" : "bg-muted hover:bg-muted/70"
              }`}
              style={openTab === t.id ? { backgroundImage: "var(--gradient-primary)" } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border/70 p-3 bg-card/60">
          {f.days.map((d, idx) => (
            openTab === `d${d.day}` ? (
              <div key={d.day}>
                <div className="text-xs font-semibold tracking-wide mb-1" style={{ color: "hsl(var(--plum))" }}>📅 Día {d.day}</div>
                <p className="text-xs muted mb-3">Organiza tantos bloques como necesites y cambia su orden con las flechas.</p>
                <ChallengeBlockEditor
                  block={d}
                  onChange={(patch) => updateDay(idx, patch)}
                  pathKey={`d${d.day}`}
                  titleLabel={`Título del día ${d.day} (opcional)`}
                />
              </div>
            ) : null
          ))}
          {EXTRAS.map(e => (
            openTab === `x-${e.key}` ? (
              <div key={e.key}>
                <div className="text-xs font-semibold tracking-wide mb-2" style={{ color: "hsl(var(--plum))" }}>{e.icon} {e.label}</div>
                <ChallengeBlockEditor
                  block={f.extras[e.key]}
                  onChange={(patch) => updateExtra(e.key, patch)}
                  pathKey={`extra-${e.key}`}
                  titleLabel="Título personalizado (opcional)"
                />
              </div>
            ) : null
          ))}
        </div>

        <button className="btn-primary w-full"><Plus className="h-4 w-4" /> {editingId ? "Guardar cambios" : "Crear reto"}</button>
      </form>

      <div className="space-y-2">
        {items.map(c => (
          <div key={c.id} className="card-elegant p-4 flex items-center justify-between gap-3">
            <div className="text-2xl">{c.icon ?? "🌸"}</div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{c.title}</div>
              <div className="text-xs muted truncate">5 días + contenido del reto</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => startEdit(c)} className="text-primary" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => del(c.id)} className="text-destructive" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
