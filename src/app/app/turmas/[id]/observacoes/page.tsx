import { eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { db } from "@/db";
import { observations, users } from "@/db/schema";
import { Form, SubmitButton } from "@/components/form";
import { addObservationAction } from "../../actions";
import { fmtDate, todayISO } from "@/lib/format";

export const metadata = { title: "Observações" };

export default async function Observacoes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const studs = await classStudents(id);
  const list = await db.select({ o: observations, author: users.name }).from(observations).innerJoin(users, eq(users.id, observations.authorId)).where(eq(observations.classId, id)).orderBy(desc(observations.observedOn), desc(observations.createdAt));
  const nameOf = new Map(studs.map((s) => [s.id, s.name]));
  const visible = list.filter(({ o }) => o.authorId === ctx.user.id || o.visibility === "school" || ctx.org.role === "coordinator");
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="card"><h2 className="mb-3">Observações</h2>
        {visible.length === 0 ? <p className="text-ink-soft">Nenhuma observação ainda.</p> : <ul className="space-y-3">{visible.map(({ o, author }) => (
          <li key={o.id} className="border-b border-line pb-3"><p className="text-sm"><strong>{fmtDate(o.observedOn)}</strong> · {author} · {o.studentId ? nameOf.get(o.studentId) ?? "aluno" : "turma"} · <span className="badge badge-gray">{o.visibility === "private" ? "privada" : "visível à escola"}</span></p><p className="mt-1">{o.text}</p></li>))}</ul>}
      </section>
      <section className="card"><h2 className="mb-2 text-lg">Nova observação</h2>
        <Form action={addObservationAction.bind(null, id)} resetOnOk>
          <div className="field"><label htmlFor="studentId">Sobre</label><select id="studentId" name="studentId" className="input"><option value="">A turma toda</option>{studs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="field"><label htmlFor="observedOn">Data</label><input id="observedOn" name="observedOn" type="date" defaultValue={todayISO()} className="input" /></div>
          <div className="field"><label htmlFor="text">Observação</label><textarea id="text" name="text" required className="input" /></div>
          <div className="field"><label htmlFor="visibility">Acesso</label><select id="visibility" name="visibility" className="input"><option value="private">Privada (só eu)</option><option value="school">Visível à coordenação</option></select></div>
          <SubmitButton>Salvar observação</SubmitButton></Form></section>
    </div>
  );
}
