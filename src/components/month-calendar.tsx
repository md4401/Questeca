import Link from "next/link";
import { spISO } from "@/lib/core/calendar";
import type { AgendaItem } from "@/lib/events";

export const CAT_COLOR: Record<string, string> = { prova: "#E5484D", trabalho: "#E39B14", evento: "#3B82F6", feriado: "#94A3B8", reuniao: "#8B5CF6", atividade: "#10B981", tarefa: "#E39B14", aula: "#64748B" };
export const CAT_LABEL: Record<string, string> = { prova: "Prova", trabalho: "Trabalho", evento: "Evento", feriado: "Feriado", reuniao: "Reunião", atividade: "Atividade", tarefa: "Prazo" };
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export const monthRange = (mes: string) => {
  const y = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { y, m, days, first: iso(y, m, 1), last: iso(y, m, days), prev: m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`, next: m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}` };
};

/** Calendário mensal (domingo a sábado) com pontos coloridos por categoria. Cada dia é um link que seleciona a data. */
export function MonthCalendar({ mes, items, selected, today, base }: { mes: string; items: AgendaItem[]; selected: string; today: string; base: string }) {
  const r = monthRange(mes);
  const lead = new Date(Date.UTC(r.y, r.m - 1, 1)).getUTCDay();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: r.days }, (_, i) => iso(r.y, r.m, i + 1))];
  const byDay = new Map<string, AgendaItem[]>();
  for (const it of items) { const d = spISO(it.start); byDay.set(d, [...(byDay.get(d) ?? []), it]); }
  const q = (m: string, d?: string) => `${base}?${new URLSearchParams({ mes: m, ...(d ? { dia: d } : {}) })}`;
  return (
    <section className="card" aria-label={`Calendário de ${MONTHS[r.m - 1]} de ${r.y}`}>
      <div className="mb-3 flex items-center justify-between">
        <Link className="icon-btn" href={q(r.prev)} aria-label="Mês anterior">‹</Link>
        <h2 className="capitalize">{MONTHS[r.m - 1]} de {r.y}</h2>
        <Link className="icon-btn" href={q(r.next)} aria-label="Próximo mês">›</Link>
      </div>
      <div className="cal" role="grid">
        {DOW.map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} role="gridcell" />;
          const ev = byDay.get(d) ?? [];
          const cats = [...new Set(ev.map((e) => e.category))].slice(0, 3);
          const n = Number(d.slice(8));
          return (
            <Link key={d} role="gridcell" href={q(mes, d)} className="cal-day" aria-current={d === today ? "date" : undefined} data-selected={d === selected} aria-label={`${n} de ${MONTHS[r.m - 1]}${ev.length ? `, ${ev.length} evento${ev.length > 1 ? "s" : ""}` : ""}`}>
              <span>{n}</span>
              <span className="dots" aria-hidden>{cats.map((c) => <i key={c} style={{ ["--c" as string]: CAT_COLOR[c] ?? "#64748B" }} />)}</span>
            </Link>);
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft" aria-label="Legenda">
        {["prova", "trabalho", "evento", "feriado", "reuniao", "atividade"].map((c) => <li key={c} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: CAT_COLOR[c] }} aria-hidden />{CAT_LABEL[c]}</li>)}
      </ul>
    </section>
  );
}

const hm = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
export function DayPanel({ date, items }: { date: string; items: AgendaItem[] }) {
  const label = new Date(date + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC", day: "numeric", month: "long" });
  return (
    <section className="card" aria-label={`Eventos de ${label}`}>
      <h2 className="mb-2">{label}</h2>
      {items.length === 0 ? <p className="empty !py-4">Nenhum evento neste dia</p> : (
        <ul className="list-rows text-sm">{items.map((e) => <li key={e.key}><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: CAT_COLOR[e.category] ?? "#64748B" }} aria-hidden /><strong>{e.href ? <Link href={e.href}>{e.title}</Link> : e.title}</strong><br /><span className="hint">{CAT_LABEL[e.category] ?? e.category} · {e.allDay ? "dia todo" : hm(e.start)}</span></li>)}</ul>)}
    </section>
  );
}

export function UpcomingList({ items, today }: { items: AgendaItem[]; today: string }) {
  const t0 = new Date(today + "T12:00:00Z").getTime();
  return (
    <section className="card" aria-label="Próximos eventos">
      <h2 className="mb-2">Próximos eventos</h2>
      {items.length === 0 ? <p className="empty !py-4">Nada marcado nos próximos dias</p> : (
        <ul className="space-y-3">{items.map((e) => { const d = spISO(e.start); const diff = Math.round((new Date(d + "T12:00:00Z").getTime() - t0) / 864e5); return (
          <li key={e.key} className="flex items-center gap-3"><span className="date-chip" style={{ ["--c" as string]: CAT_COLOR[e.category] ?? "#64748B" }} aria-hidden>{Number(d.slice(8))}</span>
            <span className="min-w-0"><span className="block truncate font-semibold">{e.title}</span><span className="hint">{diff === 0 ? "Hoje" : diff === 1 ? "Amanhã" : `Em ${diff} dias`} · {CAT_LABEL[e.category] ?? e.category}</span></span></li>); })}</ul>)}
    </section>
  );
}
