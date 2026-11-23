import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { AgendaWeek } from "@/components/agenda-week";
import { Form, SubmitButton } from "@/components/form";
import { loadAgenda, loadSlots, ensureReminders } from "@/lib/events";
import { createEventAction, deleteEventAction } from "./actions";
import { weekStart, addDaysISO, fromSP } from "@/lib/core/calendar";
import { todayISO } from "@/lib/format";
import { subjectLabel } from "@/lib/taxonomy";
import Link from "next/link";

export const metadata = { title: "Agenda" };

export default async function Agenda({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const cls = await visibleClasses(ctx);
  const classIds = cls.map((c) => c.id);
  const today = todayISO();
  const start = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(sp.semana ?? "") ? sp.semana! : today);
  await ensureReminders({ orgId: ctx.org.id, userId: ctx.user.id, classIds, href: "/app/agenda" });
  const items = await loadAgenda({ orgId: ctx.org.id, userId: ctx.user.id, classIds, from: fromSP(start), to: fromSP(addDaysISO(start, 6), "23:59") });
  const slots = (await loadSlots(ctx.org.id, classIds)).map(({ s, className }) => ({ ...s, subject: subjectLabel(s.subject), className }));
  const canSchool = ctx.org.role === "coordinator" || ctx.org.role === "admin" || ctx.org.kind === "personal";
  return (
    <div className="space-y-6">
      <div className="page-head"><h1>Agenda</h1><Link className="btn btn-ghost btn-sm" href="/app/horarios">Grade de horários</Link></div>
      <AgendaWeek start={start} items={items} slots={slots} base="/app/agenda" today={today}
        renderAction={(key) => (<form action={deleteEventAction.bind(null, key.split("@")[0])} className="mt-1"><button className="link-btn text-danger" type="submit">Excluir</button></form>)} />
      <section className="card max-w-2xl"><h2 className="mb-2 text-lg">Novo evento</h2>
        <Form action={createEventAction} resetOnOk toast>
          <div className="field"><label htmlFor="title">Título</label><input id="title" name="title" className="input" required /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="field"><label htmlFor="category">Categoria</label><select id="category" name="category" className="input"><option value="evento">Evento</option><option value="prova">Prova</option><option value="trabalho">Trabalho</option><option value="atividade">Atividade</option><option value="reuniao">Reunião</option><option value="feriado">Feriado</option></select></div>
            <div className="field"><label htmlFor="scope">Para quem</label><select id="scope" name="scope" className="input" defaultValue="personal"><option value="personal">Só para mim</option><option value="class">Uma turma</option>{canSchool && <option value="school">Toda a escola</option>}</select></div>
          </div>
          <div className="field"><label htmlFor="classId">Turma (se for de turma)</label><select id="classId" name="classId" className="input" defaultValue=""><option value="">—</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="field"><label htmlFor="date">Data</label><input id="date" name="date" type="date" className="input" required /></div>
            <div className="field"><label htmlFor="startTime">Início</label><input id="startTime" name="startTime" type="time" className="input" /></div>
            <div className="field"><label htmlFor="endTime">Término</label><input id="endTime" name="endTime" type="time" className="input" /></div>
          </div>
          <label className="mb-3 flex gap-2 font-normal"><input type="checkbox" name="allDay" />Dia todo</label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="field"><label htmlFor="freq">Repetir</label><select id="freq" name="freq" className="input" defaultValue="none"><option value="none">Não repete</option><option value="daily">Todo dia</option><option value="weekly">Toda semana</option><option value="monthly">Todo mês</option></select></div>
            <div className="field"><label htmlFor="until">Até</label><input id="until" name="until" type="date" className="input" /></div>
            <div className="field"><label htmlFor="reminder">Lembrete</label><select id="reminder" name="reminder" className="input" defaultValue=""><option value="">Sem lembrete</option><option value="30">30 min antes</option><option value="60">1 h antes</option><option value="1440">1 dia antes</option></select></div>
          </div>
          <SubmitButton>Criar evento</SubmitButton>
        </Form>
        <p className="hint mt-2">Lembretes aparecem nas notificações quando você abre a Questeca perto do horário (não há envio automático por e-mail ou push).</p>
      </section>
    </div>
  );
}
