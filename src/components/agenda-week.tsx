import Link from "next/link";
import { addDaysISO, spISO, isoWeekday, WEEKDAY } from "@/lib/core/calendar";
import type { AgendaItem } from "@/lib/events";
import type { Slot } from "@/lib/core/calendar";

const CAT: Record<string, string> = { prova: "Prova", trabalho: "Trabalho", evento: "Evento", feriado: "Feriado", reuniao: "Reunião", atividade: "Atividade", tarefa: "Prazo" };
const hm = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const dm = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

/** Semana em lista por dia (funciona em celular e desktop), com horários de aula e eventos. */
export function AgendaWeek({ start, items, slots, base, extraQuery = "", today, renderAction }: {
  start: string; items: AgendaItem[]; slots: (Slot & { className?: string })[]; base: string; extraQuery?: string; today: string;
  renderAction?: (key: string) => React.ReactNode;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
  const q = (w: string) => `${base}?${new URLSearchParams({ semana: w, ...(extraQuery ? Object.fromEntries(new URLSearchParams(extraQuery)) : {}) })}`;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Semana de {dm(start)} a {dm(days[6])}</p>
        <nav aria-label="Semana" className="flex gap-2"><Link className="btn btn-ghost btn-sm" href={q(addDaysISO(start, -7))}>← Anterior</Link><Link className="btn btn-ghost btn-sm" href={q(today)}>Hoje</Link><Link className="btn btn-ghost btn-sm" href={q(addDaysISO(start, 7))}>Próxima →</Link></nav>
      </div>
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {days.map((d) => {
          const ev = items.filter((i) => spISO(i.start) === d);
          const sl = slots.filter((s) => s.weekday === isoWeekday(d));
          return (
            <li key={d} className={`card !p-3 ${d === today ? "ring-2 ring-brand" : ""}`}>
              <h3 className="text-sm">{WEEKDAY[isoWeekday(d)]} <span className="hint">{dm(d)}</span>{d === today && <span className="badge ml-2">hoje</span>}</h3>
              {ev.length + sl.length === 0 ? <p className="mt-2 text-sm text-ink-soft">Livre.</p> : (
                <ul className="mt-2 space-y-2 text-sm">
                  {ev.map((e) => (
                    <li key={e.key} className="rounded-lg bg-brand-tint/70 p-2"><span className="badge">{CAT[e.category] ?? e.category}</span>{" "}
                      <span className="font-semibold">{e.href ? <Link href={e.href}>{e.title}</Link> : e.title}</span><br /><span className="hint">{e.allDay ? "dia todo" : `${hm(e.start)}${e.end ? `–${hm(e.end)}` : ""}`}</span>{renderAction?.(e.key)}</li>))}
                  {sl.map((s, i) => <li key={`s${i}${s.startTime}`} className="rounded-lg border border-line p-2"><span className="mono text-xs">{s.startTime}–{s.endTime}</span> <span className="font-semibold">{s.subject}</span>{s.className ? <span className="hint"> · {s.className}</span> : null}{s.room ? <span className="hint"> · {s.room}</span> : null}</li>)}
                </ul>)}
            </li>);
        })}
      </ol>
    </div>
  );
}
