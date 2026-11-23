/** Agenda e horários: recorrência, semana e conflitos. Funções puras; datas no fuso de São Paulo (UTC−3, sem horário de verão). */
export type Recurrence = { freq: "daily" | "weekly" | "monthly"; interval?: number; until: string } | null;
export type EventLike = { id: string; title: string; category: string; scope: string; classId?: string | null; startsAt: Date; endsAt?: Date | null; allDay: boolean; recurrence?: Recurrence; reminderMin?: number | null };
export type Occurrence = Omit<EventLike, "recurrence"> & { start: Date; end: Date | null; key: string };

export const SP_OFFSET_H = 3;
export const spISO = (d: Date) => new Date(d.getTime() - SP_OFFSET_H * 3600e3).toISOString().slice(0, 10);
export const fromSP = (iso: string, hhmm = "00:00") => new Date(`${iso}T${hhmm}:00-03:00`);

export function addDaysISO(iso: string, n: number) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
/** Segunda-feira da semana de `iso`. */
export function weekStart(iso: string) { const d = new Date(iso + "T12:00:00Z"); const dow = (d.getUTCDay() + 6) % 7; return addDaysISO(iso, -dow); }
/** 1 = segunda … 7 = domingo */
export function isoWeekday(iso: string) { const d = new Date(iso + "T12:00:00Z").getUTCDay(); return d === 0 ? 7 : d; }

function addMonthsKeepDay(start: Date, months: number) {
  const iso = spISO(start); const [y, m, day] = iso.split("-").map(Number);
  const total = (m - 1) + months; const ny = y + Math.floor(total / 12); const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  if (day > last) return null; // 31 de fevereiro não existe: pula a ocorrência
  const t = start.getTime() - fromSP(iso).getTime();
  return new Date(fromSP(`${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`).getTime() + t);
}

/** Ocorrências entre `from` e `to` (inclusive). No máximo 400 por evento. */
export function expand(events: EventLike[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  for (const e of events) {
    const dur = e.endsAt ? e.endsAt.getTime() - e.startsAt.getTime() : null;
    const push = (s: Date) => { if (s >= from && s <= to) out.push({ ...e, start: s, end: dur == null ? null : new Date(s.getTime() + dur), key: `${e.id}@${s.toISOString()}` }); };
    const r = e.recurrence;
    if (!r) { push(e.startsAt); continue; }
    const until = fromSP(r.until, "23:59");
    const step = Math.max(1, r.interval ?? 1);
    for (let i = 0, n = 0; n < 400; i++) {
      let s: Date | null;
      if (r.freq === "daily") s = new Date(e.startsAt.getTime() + i * step * 864e5);
      else if (r.freq === "weekly") s = new Date(e.startsAt.getTime() + i * step * 7 * 864e5);
      else s = addMonthsKeepDay(e.startsAt, i * step);
      if (s === null) { if (i > 2400) break; continue; }
      if (s > until || s > to) break;
      n++; push(s);
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/* ---------- Horários ---------- */
export type Slot = { id?: string; classId: string; teacherId: string | null; room: string | null; weekday: number; startTime: string; endTime: string; subject?: string };
const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const overlaps = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) => mins(a.startTime) < mins(b.endTime) && mins(b.startTime) < mins(a.endTime);

export type Conflict = { kind: "turma" | "professor" | "sala"; with: Slot };
/** Conflitos de um horário novo/alterado com os existentes (turma, professor ou sala no mesmo dia e horário). */
export function slotConflicts(s: Slot, existing: Slot[]): Conflict[] {
  const out: Conflict[] = [];
  for (const o of existing) {
    if (o.id && o.id === s.id) continue;
    if (o.weekday !== s.weekday || !overlaps(o, s)) continue;
    if (o.classId === s.classId) out.push({ kind: "turma", with: o });
    if (s.teacherId && o.teacherId === s.teacherId) out.push({ kind: "professor", with: o });
    if (s.room && o.room && o.room.trim().toLowerCase() === s.room.trim().toLowerCase()) out.push({ kind: "sala", with: o });
  }
  return out;
}
export const WEEKDAY = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
