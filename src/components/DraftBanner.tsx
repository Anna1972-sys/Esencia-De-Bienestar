import { Save, X } from "lucide-react";

export default function DraftBanner({ onDiscard }: { onDiscard: () => void }) {
  return (
    <div className="card-soft p-2 mb-3 flex items-center gap-2 text-xs bg-primary/5 border border-primary/20">
      <Save className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="flex-1">Borrador recuperado. Tus cambios se guardan automáticamente.</span>
      <button type="button" onClick={onDiscard} className="text-destructive inline-flex items-center gap-1">
        <X className="h-3 w-3" /> Descartar
      </button>
    </div>
  );
}
