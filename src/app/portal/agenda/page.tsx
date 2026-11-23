import { requirePortal } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";
import { AgendaWeek } from "@/components/agenda-week";
import { loadAgenda, loadSlots } from "@/lib/events";
import { weekStart, addDaysISO, fromSP } from "@/lib/core/calendar";
import { todayISO } from "@/lib/format";
import { subjectLabel } from "@/lib/taxonomy";

export const metadata = { title: "Agenda" };

export default async function PortalAgenda({ searchParams }: { searchParams: Promise<{ aluno?: string; semana?: string }> }) {
  const sp = await searchParams;
  const p = await requirePortal(sp.aluno);
  const today = todayISO();
  const start = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(sp.semana ?? "") ? sp.semana! : today);
  const items = await loadAgenda({ orgId: p.ctx.org.id, userId: p.ctx.user.id, classIds: p.classIds, from: fromSP(start), to: fromSP(addDaysISO(start, 6), "23:59"), taskHref: (id) => `/portal/tarefas/${id}${p.students.length > 1 ? `?aluno=${p.student.id}` : ""}` });
  const slots = (await loadSlots(p.ctx.org.id, p.classIds)).map(({ s, className }) => ({ ...s, subject: subjectLabel(s.subject), className }));
  return (
    <div className="space-y-4">
      <StudentSwitch list={p.students} active={p.student.id} base="/portal/agenda" />
      <h1>Agenda e horários</h1>
      <AgendaWeek start={start} items={items} slots={slots} base="/portal/agenda" extraQuery={p.students.length > 1 ? `aluno=${p.student.id}` : ""} today={today} />
    </div>
  );
}
