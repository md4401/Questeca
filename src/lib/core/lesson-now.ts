/** "Aula de Agora": descobre, pelo dia e hora (horário de Brasília), qual aula do professor está acontecendo. Puro e testável. */
export type SlotLike = { id: string; weekday: number; startTime: string; endTime: string };

const TZ = "America/Sao_Paulo";
const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function nowInSP(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return { weekday: WD[g("weekday")], minutes: Number(g("hour")) * 60 + Number(g("minute")), dateISO: `${g("year")}-${g("month")}-${g("day")}` };
}

export const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

/** Aula em andamento (início ≤ agora < fim), próxima aula do dia e a agenda completa de hoje, ordenada. */
export function lessonNow<T extends SlotLike>(slots: T[], now: Date) {
  const n = nowInSP(now);
  const today = slots.filter((s) => s.weekday === n.weekday).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  const current = today.find((s) => toMin(s.startTime) <= n.minutes && n.minutes < toMin(s.endTime)) ?? null;
  const next = today.find((s) => toMin(s.startTime) > n.minutes) ?? null;
  return { current, next, today, dateISO: n.dateISO, weekday: n.weekday, minutes: n.minutes };
}
