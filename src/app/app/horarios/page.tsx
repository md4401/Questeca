import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classTeachers, users } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { Form, SubmitButton } from "@/components/form";
import { loadSlots } from "@/lib/events";
import { createSlotAction, deleteSlotAction } from "../agenda/actions";
import { WEEKDAY } from "@/lib/core/calendar";
import { subjectLabel } from "@/lib/taxonomy";

export const metadata = { title: "Grade de horários" };

export default async function Horarios() {
  const ctx = await requireCtx();
  const cls = await visibleClasses(ctx);
  const slots = await loadSlots(ctx.org.id, cls.map((c) => c.id));
  const manager = ctx.org.role === "coordinator" || ctx.org.role === "admin";
  const teachers = manager && cls.length ? await db.select({ id: users.id, name: users.name }).from(classTeachers).innerJoin(users, eq(users.id, classTeachers.userId)) : [];
  const uniq = [...new Map(teachers.map((t) => [t.id, t])).values()];
  const byDay = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ d, rows: slots.filter((x) => x.s.weekday === d) })).filter((x) => x.rows.length);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="card"><h1 className="mb-3 text-2xl">Grade de horários</h1>
        {byDay.length === 0 ? <p className="text-ink-soft">Nenhum horário cadastrado.</p> : byDay.map(({ d, rows }) => (
          <div key={d} className="mb-4"><h2 className="text-base">{WEEKDAY[d]}</h2>
            <ul className="mt-1 divide-y divide-line text-sm">{rows.map(({ s, className }) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><span className="mono">{s.startTime}–{s.endTime}</span> · <strong>{subjectLabel(s.subject)}</strong> · {className}{s.room ? ` · ${s.room}` : ""}</span>
                <form action={deleteSlotAction.bind(null, s.id)}><button className="link-btn text-danger" type="submit" aria-label={`Remover horário de ${WEEKDAY[d]} ${s.startTime}`}>Remover</button></form></li>))}</ul></div>))}
      </section>
      <section className="card"><h2 className="mb-2 text-lg">Novo horário</h2>
        {cls.length === 0 ? <p className="text-ink-soft">Crie uma turma primeiro.</p> : (
          <Form action={createSlotAction} resetOnOk>
            <div className="field"><label htmlFor="classId">Turma</label><select id="classId" name="classId" className="input">{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="field"><label htmlFor="weekday">Dia</label><select id="weekday" name="weekday" className="input">{[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{WEEKDAY[d]}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3"><div className="field"><label htmlFor="startTime">Início</label><input id="startTime" name="startTime" type="time" className="input" required /></div><div className="field"><label htmlFor="endTime">Término</label><input id="endTime" name="endTime" type="time" className="input" required /></div></div>
            <div className="field"><label htmlFor="room">Sala (opcional)</label><input id="room" name="room" className="input" /></div>
            {manager && uniq.length > 0 && <div className="field"><label htmlFor="teacherId">Professor</label><select id="teacherId" name="teacherId" className="input">{uniq.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}
            <SubmitButton>Adicionar horário</SubmitButton>
          </Form>)}
        <p className="hint mt-2">O sistema recusa horários que colidem para a mesma turma, professor ou sala.</p>
      </section>
    </div>
  );
}
