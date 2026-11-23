import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { gradeItems, gradeSubmissions, orgs } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadApplication, classStudents } from "@/lib/access";
import { applicationData } from "@/lib/correction";
import { verifyCard } from "@/lib/core/card-token";
import { env } from "@/lib/env";
import { rulesFrom } from "@/lib/gradebook";
import { Form, SubmitButton } from "@/components/form";
import { submitCardGradeAction } from "./actions";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Cartão-resposta" };

export default async function Cartao({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await requireCtx();
  const t = verifyCard(decodeURIComponent(token), env.secret());
  if (!t) notFound();
  const { app, cls } = await loadApplication(ctx, t.appId);
  const stud = (await classStudents(app.classId)).find((s) => s.id === t.studentId);
  if (!stud) notFound();
  const data = await applicationData(app);
  const row = data.rows.find((r) => r.student.id === stud.id)!;
  const [org] = await db.select({ settings: orgs.settings, name: orgs.name }).from(orgs).where(eq(orgs.id, cls.orgId)).limit(1);
  const rules = rulesFrom(org?.settings ?? {});
  const [item] = await db.select().from(gradeItems).where(eq(gradeItems.applicationId, app.id)).limit(1);
  const [sub] = await db.select().from(gradeSubmissions).where(and(eq(gradeSubmissions.applicationId, app.id), eq(gradeSubmissions.studentId, stud.id))).limit(1);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="card">
        <p className="hint">Cartão-resposta · {cls.name} · {org?.name}</p>
        <h1 className="text-2xl" data-testid="cartao-aluno">{stud.name}</h1>
        <p className="text-ink-soft">{app.title} · {data.key.items.length} questões · total {String(data.key.total).replace(".", ",")} pontos</p>
        {sub && <p className="card-tint mt-2 text-sm" data-testid="ja-enviada">Nota já enviada à escola: <strong>{String(Number(sub.value)).replace(".", ",")}</strong>/{String(Number(sub.maxPoints)).replace(".", ",")} em {fmtDateTime(sub.submittedAt)}. Enviar de novo atualiza a nota e fica no histórico.</p>}
      </section>
      <Form action={submitCardGradeAction.bind(null, token)} className="card" toast>
        <h2 className="mb-2 text-lg">Respostas marcadas pelo aluno</h2>
        <ul className="divide-y divide-line">
          {data.key.items.map((it) => {
            const cur = row.cells.find((c) => c.position === it.position)?.value ?? "";
            return (
              <li key={it.position} className="flex items-center justify-between gap-3 py-1.5">
                <label htmlFor={`a${it.position}`} className="font-semibold">Questão {it.position}</label>
                {it.key === "*"
                  ? <input id={`a${it.position}`} name={`a${it.position}`} defaultValue={cur} inputMode="decimal" className="input w-28" placeholder={`0–${it.points}`} />
                  : <select id={`a${it.position}`} name={`a${it.position}`} defaultValue={cur} className="input w-28"><option value="">Em branco</option>{["A", "B", "C", "D", "E"].map((L) => <option key={L} value={L}>{L}</option>)}</select>}
              </li>);
          })}
        </ul>
        {!item && <div className="field mt-3"><label htmlFor="period">Período da nota</label><select id="period" name="period" className="input">{rules.periods.map((p) => <option key={p}>{p}</option>)}</select></div>}
        <label className="mt-3 flex items-center gap-2 font-normal"><input type="checkbox" name="absent" />Aluno ausente na prova</label>
        <div className="mt-3"><SubmitButton pendingLabel="Enviando…">Corrigir e enviar nota à escola</SubmitButton></div>
        <p className="hint mt-2">A nota é calculada pelo gabarito da prova e lançada na turma; a coordenação é avisada.</p>
      </Form>
    </div>
  );
}
