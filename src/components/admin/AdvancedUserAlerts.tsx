import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellPlus, Check, ClipboardCheck, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Client = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type Activity = {
  user_id: string;
  last_seen_at: string;
  active_seconds: number;
};

type ChallengeProgress = {
  user_id: string;
  challenge_id: string;
  completed_at: string;
  challenges: { title?: string; days?: unknown[] } | null;
};

type Reminder = {
  id: string;
  user_id: string;
  note: string;
  due_at: string;
  completed_at: string | null;
};

type AdvancedAlert = {
  id: string;
  userId: string;
  clientName: string;
  message: string;
  tone: "rose" | "amber";
  kind: "challenge" | "activity" | "reminder";
  reminderId?: string;
};

const DAY = 24 * 60 * 60 * 1000;

export default function AdvancedUserAlerts({ clients }: { clients: Client[] }) {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [progress, setProgress] = useState<ChallengeProgress[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [available, setAvailable] = useState(true);

  const load = async () => {
    const [activityResult, progressResult, reminderResult] = await Promise.all([
      (supabase as any)
        .from("user_activity_sessions")
        .select("user_id,last_seen_at,active_seconds")
        .gte("last_seen_at", new Date(Date.now() - 21 * DAY).toISOString())
        .limit(5000),
      (supabase as any)
        .from("challenge_progress")
        .select("user_id,challenge_id,completed_at,challenges(title,days)")
        .order("completed_at", { ascending: false })
        .limit(5000),
      (supabase as any)
        .from("follow_up_reminders")
        .select("id,user_id,note,due_at,completed_at")
        .is("completed_at", null)
        .order("due_at", { ascending: true }),
    ]);

    setActivity((activityResult.data ?? []) as Activity[]);
    setProgress((progressResult.data ?? []) as ChallengeProgress[]);
    if (reminderResult.error) {
      setAvailable(false);
      setReminders([]);
    } else {
      setAvailable(true);
      setReminders((reminderResult.data ?? []) as Reminder[]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const alerts = useMemo(() => {
    const now = Date.now();
    const clientById = new Map(clients.map(client => [client.id, client]));
    const result: AdvancedAlert[] = [];

    clients.forEach(client => {
      const clientActivity = activity.filter(row => row.user_id === client.id);
      const recentSeconds = clientActivity
        .filter(row => +new Date(row.last_seen_at) >= now - 7 * DAY)
        .reduce((sum, row) => sum + Number(row.active_seconds || 0), 0);
      const previousSeconds = clientActivity
        .filter(row => +new Date(row.last_seen_at) < now - 7 * DAY && +new Date(row.last_seen_at) >= now - 14 * DAY)
        .reduce((sum, row) => sum + Number(row.active_seconds || 0), 0);

      if (previousSeconds >= 30 * 60 && recentSeconds < previousSeconds * 0.4) {
        result.push({
          id: `activity-${client.id}`,
          userId: client.id,
          clientName: client.display_name || client.email || "Clienta",
          message: "Su actividad ha bajado notablemente esta semana",
          tone: "amber",
          kind: "activity",
        });
      }
    });

    const progressByChallenge = new Map<string, ChallengeProgress[]>();
    progress.forEach(row => {
      const key = `${row.user_id}:${row.challenge_id}`;
      const list = progressByChallenge.get(key) ?? [];
      list.push(row);
      progressByChallenge.set(key, list);
    });
    progressByChallenge.forEach((rows, key) => {
      const latest = rows.reduce((current, row) => +new Date(row.completed_at) > +new Date(current.completed_at) ? row : current);
      const totalDays = Array.isArray(latest.challenges?.days) ? latest.challenges.days.length : 5;
      const client = clientById.get(latest.user_id);
      if (client && rows.length < totalDays && now - +new Date(latest.completed_at) >= 7 * DAY) {
        result.push({
          id: `challenge-${key}`,
          userId: client.id,
          clientName: client.display_name || client.email || "Clienta",
          message: `Reto “${latest.challenges?.title || "5 días"}” sin continuar desde hace 7 días`,
          tone: "amber",
          kind: "challenge",
        });
      }
    });

    reminders.forEach(reminder => {
      const client = clientById.get(reminder.user_id);
      if (!client) return;
      const overdue = +new Date(reminder.due_at) <= now;
      result.push({
        id: `reminder-${reminder.id}`,
        userId: client.id,
        clientName: client.display_name || client.email || "Clienta",
        message: `${overdue ? "Recordatorio pendiente" : "Próximo seguimiento"}: ${reminder.note}`,
        tone: overdue ? "rose" : "amber",
        kind: "reminder",
        reminderId: reminder.id,
      });
    });

    return result.sort((a, b) => (a.tone === "rose" ? 0 : 1) - (b.tone === "rose" ? 0 : 1));
  }, [activity, clients, progress, reminders]);

  const createReminder = async () => {
    if (!available) {
      toast.warning("Primero aplica la actualización de alertas avanzadas en Supabase.");
      return;
    }
    const clientName = window.prompt("Escribe el nombre o correo de la clienta:");
    if (!clientName?.trim()) return;
    const client = clients.find(item =>
      `${item.display_name ?? ""} ${item.email ?? ""}`.toLowerCase().includes(clientName.trim().toLowerCase()),
    );
    if (!client) {
      toast.error("No se ha encontrado esa clienta.");
      return;
    }
    const note = window.prompt("¿Qué seguimiento quieres recordar?");
    if (!note?.trim()) return;
    const date = window.prompt("Fecha del recordatorio (AAAA-MM-DD):", new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10));
    if (!date || Number.isNaN(+new Date(`${date}T09:00:00`))) return;
    const { error } = await (supabase as any).from("follow_up_reminders").insert({
      user_id: client.id,
      note: note.trim(),
      due_at: new Date(`${date}T09:00:00`).toISOString(),
    });
    if (error) {
      toast.error("No se pudo crear el recordatorio.");
      return;
    }
    toast.success("Recordatorio creado");
    await load();
  };

  const completeReminder = async (id: string) => {
    const { error } = await (supabase as any)
      .from("follow_up_reminders")
      .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("No se pudo completar el recordatorio.");
      return;
    }
    toast.success("Seguimiento completado");
    await load();
  };

  return (
    <section id="alertas-avanzadas" className="card-elegant p-4 mb-4 scroll-mt-6" aria-label="Alertas avanzadas">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-base" style={{ color: "hsl(var(--plum))" }}>Alertas avanzadas</h2>
          </div>
          <p className="text-[11px] muted mt-1">Retos, cambios de actividad y seguimientos privados.</p>
        </div>
        <button type="button" className="btn-secondary compact" onClick={createReminder}>
          <BellPlus className="h-3.5 w-3.5" /> Recordatorio
        </button>
      </div>

      {!available ? (
        <div className="rounded-xl bg-amber-50 text-amber-700 p-3 text-xs">
          Falta activar las alertas avanzadas en Supabase. Las alertas actuales continúan funcionando.
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 text-xs">No hay alertas avanzadas pendientes.</div>
      ) : (
        <div className="space-y-1.5">
          {alerts.slice(0, 8).map(alert => (
            <div key={alert.id} className={`rounded-xl px-3 py-2 flex items-center gap-2 text-xs ${
              alert.tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
            }`}>
              {alert.kind === "challenge" ? <Trophy className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              <span className="font-semibold">{alert.clientName}</span>
              <span className="min-w-0 flex-1">{alert.message}</span>
              {alert.reminderId && (
                <button type="button" className="h-7 w-7 rounded-full bg-white/80 grid place-items-center" onClick={() => completeReminder(alert.reminderId!)}>
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
