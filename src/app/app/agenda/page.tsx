import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { MonthCalendar, DayPanel, UpcomingList, monthRange } from "@/components/month-calendar";
import { PageHead } from "@/components/page-head";
import { loadAgenda, ensureReminders } from "@/lib/events";
import { deleteEventAction } from "./actions";
import { NovoEvento } from "./novo-evento";
import { addDaysISO, fromSP, spISO } from "@/lib/core/calendar";
import { todayISO } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Agenda" };

export default async function Agenda({ searchParams }: { searchParams: Promise<{ semana?: string; mes?: string; dia?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const cls = await visibleClasses(ctx);
  const classIds = cls.map((c) => c.id);
  const today = todayISO();
  await ensureReminders({ orgId: ctx.org.id, userId: ctx.user.id, classIds, href: "/app/agenda" });
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes ?? "") ? sp.mes! : (/^\d{4}-\d{2}-\d{2}$/.test(sp.dia ?? "") ? sp.dia!.slice(0, 7) : today.slice(0, 7));
  const mr = monthRange(mes);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(sp.dia ?? "") && sp.dia!.startsWith(mes) ? sp.dia! : (today.startsWith(mes) ? today : mr.first);
  const monthItems = await loadAgenda({ orgId: ctx.org.id, userId: ctx.user.id, classIds, from: fromSP(mr.first), to: fromSP(mr.last, "23:59") });
  const upcoming = (await loadAgenda({ orgId: ctx.org.id, userId: ctx.user.id, classIds, from: fromSP(today), to: fromSP(addDaysISO(today, 60), "23:59") })).slice(0, 5);
  const canSchool = ctx.org.role === "coordinator" || ctx.org.role === "admin" || ctx.org.kind === "personal";
  return (
    <div className="space-y-6">
      <PageHead icon="agenda" title="Agenda" sub="Calendário, aulas e eventos" actions={<><Link className="btn btn-ghost btn-sm" href="/app/horarios">Grade de horários</Link><NovoEvento classes={cls.map((c) => ({ id: c.id, name: c.name }))} canSchool={canSchool} defaultDate={dia} /></>} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <MonthCalendar mes={mes} items={monthItems} selected={dia} today={today} base="/app/agenda" />
        <div className="space-y-4"><DayPanel date={dia} items={monthItems.filter((i) => spISO(i.start) === dia)} renderAction={(key) => (key.includes("@") ? <form action={deleteEventAction.bind(null, key.split("@")[0])} className="mt-1"><button className="link-btn text-danger" type="submit">Excluir</button></form> : null)} /><UpcomingList items={upcoming} today={today} /></div>
      </div>
    </div>
  );
}
