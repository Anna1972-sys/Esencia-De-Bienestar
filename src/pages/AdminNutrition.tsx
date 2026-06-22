import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import LibraryAdminPage from "@/components/library/LibraryAdminPage";
import { toast } from "sonner";
import { Pencil, Save, X } from "lucide-react";

type Category = { id: string; key: string; label: string; emoji: string; sort_order: number };

export default function AdminNutrition() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editEmoji, setEditEmoji] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("nutrition_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    else setCategories(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (cat: Category) => {
    setEditing(cat.id);
    setEditLabel(cat.label);
    setEditEmoji(cat.emoji || "");
  };

  const saveEdit = async (id: string) => {
    const { error } = await (supabase as any)
      .from("nutrition_categories")
      .update({ label: editLabel.trim(), emoji: editEmoji.trim() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Categoría actualizada"); setEditing(null); load(); }
  };

  const cancelEdit = () => setEditing(null);

  const catProps = categories.map(c => ({ key: c.key, label: c.label, emoji: c.emoji }));

  return (
    <div className="pb-28">
      <div className="card-soft p-4 mb-6">
        <h2 className="font-medium mb-3">Categorías de Nutrición</h2>
        {loading ? (
          <div className="text-sm muted">Cargando categorías…</div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2">
                {editing === cat.id ? (
                  <>
                    <input className="field w-16 text-center" value={editEmoji} onChange={e => setEditEmoji(e.target.value)} placeholder="Emoji" />
                    <input className="field flex-1" value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="Nombre" />
                    <button type="button" onClick={() => saveEdit(cat.id)} className="btn-primary px-3 py-1.5 text-sm"><Save className="h-4 w-4" /></button>
                    <button type="button" onClick={cancelEdit} className="btn-secondary px-3 py-1.5 text-sm"><X className="h-4 w-4" /></button>
                  </>
                ) : (
                  <>
                    <span className="text-xl w-8 text-center">{cat.emoji}</span>
                    <span className="flex-1 text-sm">{cat.label}</span>
                    <button type="button" onClick={() => startEdit(cat)} className="text-primary p-1"><Pencil className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <LibraryAdminPage
          table="nutrition_items"
          storageFolder="nutrition"
          backTo="/app/admin"
          title="Nutrición deportiva"
          categories={catProps}
        />
      )}
    </div>
  );
}
