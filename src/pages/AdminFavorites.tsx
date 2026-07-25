import { useEffect, useMemo, useState } from "react";
import { BarChart3, Heart, MousePointerClick } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import type { FavoriteContentType } from "@/contexts/FavoritesContext";
import { supabase } from "@/integrations/supabase/client";

type StatRow = {
  content_type: FavoriteContentType;
  content_id: string;
  title: string | null;
  saved_count: number;
  total_opens: number;
  last_opened_at: string | null;
};

const labels: Record<FavoriteContentType, string> = {
  recipe: "Receta",
  video: "Vídeo",
  guide: "Guía",
  exercise: "Ejercicio",
};

export default function AdminFavorites() {
  const [rows, setRows] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"saved" | "used">("saved");

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_favorite_content_stats");
      if (!error) setRows((data ?? []) as StatRow[]);
      setLoading(false);
    })();
  }, []);

  const ordered = useMemo(() => [...rows].sort((a, b) => (
    mode === "saved"
      ? Number(b.saved_count) - Number(a.saved_count)
      : Number(b.total_opens) - Number(a.total_opens)
  )), [rows, mode]);

  const totalSaved = rows.reduce((sum, row) => sum + Number(row.saved_count || 0), 0);
  const totalOpens = rows.reduce((sum, row) => sum + Number(row.total_opens || 0), 0);

  return (
    <div className="pb-28">
      <AdminPageHeader
        title="Estadísticas de favoritos"
        subtitle="Conoce qué contenido guardan y vuelven a consultar tus clientas."
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card-soft p-4">
          <Heart className="h-4 w-4 text-primary fill-primary mb-2" />
          <div className="font-serif text-2xl">{totalSaved}</div>
          <div className="text-xs muted">Favoritos guardados</div>
        </div>
        <div className="card-soft p-4">
          <MousePointerClick className="h-4 w-4 text-primary mb-2" />
          <div className="font-serif text-2xl">{totalOpens}</div>
          <div className="text-xs muted">Aperturas desde Favoritos</div>
        </div>
      </div>

      <div className="flex gap-1 bg-muted rounded-full p-1 mb-4">
        <button
          type="button"
          onClick={() => setMode("saved")}
          className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${mode === "saved" ? "bg-white shadow-soft" : ""}`}
        >
          Más guardado
        </button>
        <button
          type="button"
          onClick={() => setMode("used")}
          className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${mode === "used" ? "bg-white shadow-soft" : ""}`}
        >
          Más utilizado
        </button>
      </div>

      {loading ? (
        <div className="card-soft p-6 text-center muted">Cargando estadísticas…</div>
      ) : ordered.length === 0 ? (
        <div className="card-soft p-7 text-center">
          <BarChart3 className="h-8 w-8 text-primary/50 mx-auto mb-2" />
          <div className="font-medium">Todavía no hay favoritos</div>
          <p className="text-sm muted mt-1">Las estadísticas aparecerán cuando las clientas empiecen a guardar contenido.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordered.map((row, index) => (
            <div key={`${row.content_type}:${row.content_id}`} className="card-soft p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center font-serif">{index + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{row.title || "Contenido eliminado"}</div>
                <div className="text-[11px] muted">{labels[row.content_type]}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold text-sm">{mode === "saved" ? row.saved_count : row.total_opens}</div>
                <div className="text-[10px] muted">{mode === "saved" ? "guardados" : "aperturas"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
