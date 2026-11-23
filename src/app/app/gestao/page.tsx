import { redirect } from "next/navigation";
import { and, desc, eq, ilike, inArray, isNull, gt, or, count } from "drizzle-orm";
import { db } from "@/db";
import { students, classes, enrollments, enrollmentHistory, accessInvites, studentAccounts, guardianLinks, users } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { Form, SubmitButton } from "@/components/form";
import { updateStudentAction, transferStudentAction, revokeAccessInviteAction, rolloverClassAction } from "./actions";
import { fmtDateTime } from "@/lib/format";
import { gradeLabel, subjectLabel } from "@/lib/taxonomy";

export const metadata = { title: "Gestão acadêmica" };

export default async function Gestao({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireCtx();
  if (ctx.org.role !== "coordinator" && ctx.org.role !== "admin") redirect("/app");
  const sp = await searchParams; const term = (sp.q ?? "").trim().slice(0, 80);
  const cls = await db.select().from(classes).where(and(eq(classes.orgId, ctx.org.id), eq(classes.archived, false))).orderBy(classes.year, classes.name);
  const like = term ? `%${term.replace(/[%_\\]/g, "\\$&")}%` : null;
  const sts = await db.select().from(students).where(and(eq(students.orgId, ctx.org.id), like ? or(ilike(students.name, like), ilike(students.registration, like)) : undefined)).orderBy(students.name).limit(60);
  const ids = sts.map((s) => s.id);
  const enr = ids.length ? await db.select().from(enrollments).where(and(inArray(enrollments.studentId, ids), eq(enrollments.status, "active"))) : [];
  const acc = ids.length ? await db.select({ s: studentAccounts.studentId, n: count() }).from(studentAccounts).where(inArray(studentAccounts.studentId, ids)).groupBy(studentAccounts.studentId) : [];
  const gl = ids.length ? await db.select({ s: guardianLinks.studentId, n: count() }).from(guardianLinks).where(inArray(guardianLinks.studentId, ids)).groupBy(guardianLinks.studentId) : [];
  const pending = await db.select({ i: accessInvites, who: students.name }).from(accessInvites).innerJoin(students, eq(students.id, accessInvites.studentId)).where(and(eq(accessInvites.orgId, ctx.org.id), isNull(accessInvites.usedAt), isNull(accessInvites.revokedAt), gt(accessInvites.expiresAt, new Date())));
  const hist = await db.select({ h: enrollmentHistory, who: students.name, by: users.name }).from(enrollmentHistory).innerJoin(students, eq(students.id, enrollmentHistory.studentId)).innerJoin(users, eq(users.id, enrollmentHistory.actorId)).where(eq(enrollmentHistory.orgId, ctx.org.id)).orderBy(desc(enrollmentHistory.createdAt)).limit(15);
  const cname = (id: string | null) => cls.find((c) => c.id === id)?.name ?? "—";
  return (
    <div className="space-y-6">
      <div><h1>Gestão acadêmica</h1><p className="hint">Cadastros, matrículas, transferências e acessos. Esta área não mostra notas nem registros pedagógicos; cobrança fica em “Plano e cobrança”.</p></div>
      <section className="card"><h2 className="mb-2 text-lg">Alunos</h2>
        <form className="mb-3 flex gap-2" role="search"><label className="sr-only" htmlFor="q">Buscar aluno</label><input id="q" name="q" defaultValue={term} className="input flex-1" placeholder="Nome ou matrícula" /><button className="btn btn-ghost" type="submit">Buscar</button></form>
        {sts.length === 0 ? <p className="text-ink-soft">Nenhum aluno encontrado.</p> : (
          <ul className="divide-y divide-line">{sts.map((s) => {
            const mine = enr.filter((e) => e.studentId === s.id);
            return (
              <li key={s.id} className="space-y-2 py-3">
                <p><strong>{s.name}</strong> <span className="hint">· {s.registration ?? "sem matrícula"} · {mine.map((e) => cname(e.classId)).join(", ") || "sem turma ativa"} · acessos: {Number(acc.find((a) => a.s === s.id)?.n ?? 0)} aluno, {Number(gl.find((g) => g.s === s.id)?.n ?? 0)} responsável(is)</span></p>
                <details><summary className="cursor-pointer text-sm font-semibold text-brand">Editar ou transferir</summary>
                  <div className="mt-2 grid gap-4 md:grid-cols-2">
                    <Form action={updateStudentAction.bind(null, s.id)} toast><div className="field"><label htmlFor={`n-${s.id}`}>Nome</label><input id={`n-${s.id}`} name="name" className="input" defaultValue={s.name} /></div><div className="field"><label htmlFor={`r-${s.id}`}>Matrícula</label><input id={`r-${s.id}`} name="registration" className="input" defaultValue={s.registration ?? ""} /></div><SubmitButton className="btn btn-sm">Salvar cadastro</SubmitButton></Form>
                    {mine.length > 0 && <Form action={transferStudentAction.bind(null, s.id)} toast>
                      <div className="field"><label htmlFor={`f-${s.id}`}>Da turma</label><select id={`f-${s.id}`} name="fromClassId" className="input">{mine.map((e) => <option key={e.classId} value={e.classId}>{cname(e.classId)}</option>)}</select></div>
                      <div className="field"><label htmlFor={`t-${s.id}`}>Para a turma</label><select id={`t-${s.id}`} name="toClassId" className="input" defaultValue=""><option value="" disabled>Escolha…</option>{cls.filter((c) => !mine.some((e) => e.classId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name} · {gradeLabel(c.grade)} · {c.year}</option>)}</select></div>
                      <div className="field"><label htmlFor={`m-${s.id}`}>Motivo (opcional)</label><input id={`m-${s.id}`} name="reason" className="input" /></div><SubmitButton className="btn btn-sm">Transferir</SubmitButton></Form>}
                  </div></details>
              </li>);
          })}</ul>)}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card"><h2 className="mb-2 text-lg">Convites de acesso pendentes</h2>
          {pending.length === 0 ? <p className="text-sm text-ink-soft">Nenhum.</p> : <ul className="space-y-2 text-sm">{pending.map(({ i, who }) => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2"><span>{who} · {i.kind === "student" ? "aluno" : "responsável"} <span className="hint">· expira {fmtDateTime(i.expiresAt)}</span></span><form action={revokeAccessInviteAction.bind(null, i.id)}><button className="link-btn text-danger" type="submit" aria-label={`Revogar convite de ${who}`}>Revogar</button></form></li>)}</ul>}</section>
        <section className="card"><h2 className="mb-2 text-lg">Movimentações recentes</h2>
          {hist.length === 0 ? <p className="text-sm text-ink-soft">Nenhuma.</p> : <ul className="space-y-1 text-sm">{hist.map(({ h, who, by }) => <li key={h.id}>{who}: {cname(h.fromClassId)} → <strong>{cname(h.toClassId)}</strong>{h.reason ? ` (${h.reason})` : ""} <span className="hint">· {by}, {fmtDateTime(h.createdAt)}</span></li>)}</ul>}</section>
      </div>
      <section className="card"><h2 className="mb-2 text-lg">Turmas e ano letivo</h2>
        <table className="t"><thead><tr><th>Turma</th><th>Série</th><th>Disciplina</th><th>Ano</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
          {cls.map((c) => <tr key={c.id}><td>{c.name}</td><td>{gradeLabel(c.grade)}</td><td>{subjectLabel(c.subject)}</td><td>{c.year}</td><td><form action={rolloverClassAction.bind(null, c.id)}><button className="link-btn" type="submit" aria-label={`Criar ${c.name} para ${c.year + 1}`}>Criar para {c.year + 1}</button></form></td></tr>)}
        </tbody></table>
        <p className="hint mt-2">A turma do próximo ano nasce sem alunos e com os mesmos professores. Convites por e-mail e papéis ficam em “Regras da escola”.</p></section>
    </div>
  );
}
