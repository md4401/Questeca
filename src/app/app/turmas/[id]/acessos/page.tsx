import { and, eq, isNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { accessInvites, studentAccounts, guardianLinks, users, students } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { Form, SubmitButton } from "@/components/form";
import { createInviteAction, revokeInviteAction, revokeAccessAction } from "./actions";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Acessos de alunos e responsáveis" };

export default async function Acessos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, id);
  const list = await classStudents(id);
  const ids = list.map((s) => s.id);
  const inClass = (sid: string) => ids.includes(sid);
  const accounts = (await db.select({ userId: studentAccounts.userId, studentId: studentAccounts.studentId, name: users.name, email: users.email }).from(studentAccounts).innerJoin(users, eq(users.id, studentAccounts.userId)).where(eq(studentAccounts.orgId, cls.orgId))).filter((a) => inClass(a.studentId));
  const guardians = (await db.select({ userId: guardianLinks.userId, studentId: guardianLinks.studentId, name: users.name, email: users.email, relation: guardianLinks.relation }).from(guardianLinks).innerJoin(users, eq(users.id, guardianLinks.userId)).where(eq(guardianLinks.orgId, cls.orgId))).filter((a) => inClass(a.studentId));
  const pending = (await db.select({ id: accessInvites.id, studentId: accessInvites.studentId, kind: accessInvites.kind, expiresAt: accessInvites.expiresAt, name: students.name }).from(accessInvites).innerJoin(students, eq(students.id, accessInvites.studentId))
    .where(and(eq(accessInvites.orgId, cls.orgId), isNull(accessInvites.usedAt), isNull(accessInvites.revokedAt), gt(accessInvites.expiresAt, new Date())))).filter((a) => inClass(a.studentId));
  const nameOf = (sid: string) => list.find((s) => s.id === sid)?.name ?? "—";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <section className="card">
        <h2 className="mb-1 text-lg">Convidar para o portal</h2>
        <p className="hint mb-3">Alunos e responsáveis veem só o que é deles: tarefas, agenda, notas e frequência. O link vale 14 dias e funciona uma única vez.</p>
        {list.length === 0 ? <p className="text-ink-soft">Cadastre alunos primeiro.</p> : (
          <Form action={createInviteAction.bind(null, id)}>
            <div className="field"><label htmlFor="studentId">Aluno</label><select id="studentId" name="studentId" className="input" defaultValue="">{<option value="" disabled>Escolha…</option>}{list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="field"><label htmlFor="kind">Quem vai acessar</label><select id="kind" name="kind" className="input"><option value="guardian">Responsável</option><option value="student">O próprio aluno</option></select></div>
            <div className="field"><label htmlFor="relation">Parentesco (opcional)</label><input id="relation" name="relation" className="input" placeholder="Mãe, pai, avó…" /></div>
            <SubmitButton>Gerar link</SubmitButton>
          </Form>)}
      </section>
      <div className="space-y-6">
        <section className="card"><h2 className="mb-2 text-lg">Convites pendentes</h2>
          {pending.length === 0 ? <p className="text-sm text-ink-soft">Nenhum.</p> : <ul className="space-y-2 text-sm">{pending.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2"><span>{p.name} · {p.kind === "student" ? "aluno" : "responsável"} <span className="hint">· expira {fmtDateTime(p.expiresAt)}</span></span>
              <form action={revokeInviteAction.bind(null, id, p.id)}><button className="link-btn text-danger" type="submit">Revogar</button></form></li>))}</ul>}
        </section>
        <section className="card"><h2 className="mb-2 text-lg">Contas com acesso</h2>
          {accounts.length + guardians.length === 0 ? <p className="text-sm text-ink-soft">Nenhuma conta ainda.</p> : (
            <table className="t"><thead><tr><th>Estudante</th><th>Conta</th><th>Tipo</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
              {accounts.map((a) => <tr key={`s${a.userId}${a.studentId}`}><td>{nameOf(a.studentId)}</td><td>{a.name}<br /><span className="hint">{a.email}</span></td><td>Aluno</td><td><form action={revokeAccessAction.bind(null, id, "student", a.userId, a.studentId)}><button className="link-btn text-danger" type="submit" aria-label={`Revogar acesso de ${a.name}`}>Revogar</button></form></td></tr>)}
              {guardians.map((a) => <tr key={`g${a.userId}${a.studentId}`}><td>{nameOf(a.studentId)}</td><td>{a.name}<br /><span className="hint">{a.email}</span></td><td>Responsável{a.relation ? ` (${a.relation})` : ""}</td><td><form action={revokeAccessAction.bind(null, id, "guardian", a.userId, a.studentId)}><button className="link-btn text-danger" type="submit" aria-label={`Revogar acesso de ${a.name}`}>Revogar</button></form></td></tr>)}
            </tbody></table>)}
        </section>
      </div>
    </div>
  );
}
