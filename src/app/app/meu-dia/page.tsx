import Link from "next/link";
import { and, eq, inArray, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { attendanceSessions, lessonPlans, assessments } from "@/db/schema";
import { loadLessonNow } from "@/lib/lesson-now";
import { PageHead } from "@/components/page-head";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Meu dia" };
const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** O dia do professor num só lugar: aulas de hoje, chamada pendente, plano pronto e atalhos. */
export default async function MeuDia() {
  const ctx = await requireCtx();
  const ln = await loadLessonNow(ctx);
  const dateISO = ln?.dateISO ?? new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const agenda = ln?.agenda ?? [];
  const classIds = [...new Set(agenda.map((a) => a.cls.id))];
  const [sessoes, planos, rascunhos] = await Promise.all([
    classIds.length ? db.select({ classId: attendanceSessions.classId, lesson: attendanceSessions.lesson }).from(attendanceSessions).where(and(inArray(attendanceSessions.classId, classIds), eq(attendanceSessions.date, dateISO))) : [],
    classIds.length ? db.select({ id: lessonPlans.id, classId: lessonPlans.classId, theme: lessonPlans.theme }).from(lessonPlans).where(and(inArray(lessonPlans.classId, classIds), eq(lessonPlans.plannedFor, dateISO))).orderBy(desc(lessonPlans.updatedAt)) : [],
    db.select({ id: assessments.id, title: assessments.title }).from(assessments).where(and(eq(assessments.ownerId, ctx.user.id), eq(assessments.orgId, ctx.org.id), eq(assessments.status, "draft"))).orderBy(desc(assessments.updatedAt)).limit(5),
  ]);
  const d = new Date(`${dateISO}T12:00:00Z`);
  const feita = (classId: string, hora: string) => sessoes.some((s) => s.classId === classId && s.lesson === hora);
  const pendentes = agenda.filter((a) => !feita(a.cls.id, a.slot.startTime)).length;
  return (
    <div className="space-y-4">
      <PageHead icon="agenda" title="Meu dia" sub={`${DIAS[d.getUTCDay()]}, ${fmtDate(dateISO)}${agenda.length ? ` · ${agenda.length} aula(s)` : ""}`} />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="card"><h2 className="mb-3 text-lg">Aulas de hoje</h2>
          {agenda.length === 0 ? <p className="text-ink-soft" data-testid="sem-aulas">Nenhuma aula no horário de hoje. Cadastre seus horários em <Link href="/app/horarios">Horários</Link> para ver tudo aqui.</p> : (
            <ul className="divide-y divide-line">{agenda.map(({ slot, cls }) => {
              const ok = feita(cls.id, slot.startTime); const plano = planos.find((p) => p.classId === cls.id);
              return (
                <li key={slot.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-24 shrink-0 font-bold tabular-nums text-brand">{slot.startTime}–{slot.endTime}</span>
                  <span className="min-w-0 flex-1"><Link href={`/app/turmas/${cls.id}`} className="font-semibold">{cls.name}</Link><span className="hint block">{slot.subject}{slot.room ? ` · sala ${slot.room}` : ""}</span>
                    {plano ? <Link className="text-sm" href={`/app/planos-de-aula/${plano.id}`}>Plano: {plano.theme}</Link> : <span className="hint text-sm">Sem plano para hoje</span>}</span>
                  <span className={`badge ${ok ? "" : "badge-amber"}`}>{ok ? "Chamada feita" : "Chamada pendente"}</span>
                  {!ok && <Link className="btn btn-sm" href={`/app/turmas/${cls.id}/frequencia`}>Fazer chamada</Link>}
                </li>); })}</ul>)}
        </section>
        <div className="space-y-4">
          {agenda.length > 0 && <section className={pendentes ? "card-amber" : "card"}><h2 className="mb-1 text-lg">Pendências</h2><p className="text-sm">{pendentes ? `${pendentes} chamada(s) para fazer hoje.` : "Tudo em dia por aqui. 🎉"}</p></section>}
          <section className="card"><h2 className="mb-2 text-lg">Atalhos</h2>
            <div className="grid gap-2"><Link className="btn btn-ghost" href="/app/assistente">Perguntar à GizIA</Link><Link className="btn btn-ghost" href="/app/quiz">Quiz ao vivo</Link><Link className="btn btn-ghost" href="/app/provas/montar">Montar prova</Link><Link className="btn btn-ghost" href="/app/agenda">Agenda</Link></div></section>
          {rascunhos.length > 0 && <section className="card"><h2 className="mb-2 text-lg">Provas em rascunho</h2><ul className="space-y-1 text-sm">{rascunhos.map((r) => <li key={r.id}><Link href={`/app/provas/${r.id}`}>{r.title}</Link></li>)}</ul></section>}
        </div>
      </div>
    </div>
  );
}
