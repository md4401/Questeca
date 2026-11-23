import Link from "next/link";
import { eq, desc, and } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { loadAssessment, loadApplication } from "@/lib/access";
import { db } from "@/db";
import { applications, answerSheets } from "@/db/schema";
import { applicationData } from "@/lib/correction";
import { ResponseGrid } from "@/components/response-grid";
import { Form, Field, SubmitButton } from "@/components/form";
import { publishGradesAction, uploadSheetsAction, confirmSheetAction, rejectSheetAction } from "../../correcao-actions";
import { rulesFrom } from "@/lib/gradebook";
import { fmtDate } from "@/lib/format";
import { planInfo } from "@/lib/billing";

export const metadata = { title: "Correção" };

export default async function Correcao({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ app?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const apps = await db.select().from(applications).where(eq(applications.assessmentId, id)).orderBy(desc(applications.createdAt));
  if (!apps.length) return <div className="card"><p>Esta prova ainda não foi aplicada. Marque a aplicação para registrar respostas e corrigir.</p><Link className="btn mt-3" href={`/app/provas/${id}/aplicacao`}>Ir para a aplicação</Link></div>;
  const current = apps.find((x) => x.id === sp.app) ?? apps[0];
  const { cls } = await loadApplication(ctx, current.id);
  const data = await applicationData(current);
  const sheets = await db.select({ id: answerSheets.id, status: answerSheets.status, note: answerSheets.note, detected: answerSheets.detected, studentId: answerSheets.studentId }).from(answerSheets).where(and(eq(answerSheets.applicationId, current.id)));
  const pendingSheets = sheets.filter((s) => s.status === "pending_review");
  const info = await planInfo(ctx.org.id);
  const rules = rulesFrom(ctx.org.settings);
  const done = data.rows.filter((r) => r.complete || r.absent).length;
  const expectedCode = `${current.id.slice(0, 8).toUpperCase()}-V${data.key.versionNumber ?? 0}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl">{current.title}</h1><p className="hint">{cls.name} · {fmtDate(current.appliedOn)} · {data.key.versionNumber ? `versão ${data.key.versionNumber}` : "avaliação externa"} · {done} de {data.rows.length} aluno(s) com leitura completa ou ausência</p></div>
        {apps.length > 1 && <nav aria-label="Aplicações" className="flex flex-wrap gap-1">{apps.map((x) => <Link key={x.id} className={`btn btn-sm ${x.id === current.id ? "" : "btn-ghost"}`} href={`/app/provas/${id}/correcao?app=${x.id}`}>{fmtDate(x.appliedOn)}</Link>)}</nav>}
      </div>

      <section><h2 className="mb-2 text-lg">Lançamento manual de respostas</h2>
        <ResponseGrid key={current.id} appId={current.id} items={data.key.items.map((i) => ({ position: i.position, key: i.key, points: i.points, rubric: i.rubric }))}
          rows={data.rows.map((r) => ({ studentId: r.student.id, name: r.student.name, absent: r.absent, cells: Object.fromEntries(r.cells.filter((c) => c.value !== "").map((c) => [c.position, c.value])), total: r.total, complete: r.complete }))} />
        <p className="hint mt-2">Gabarito da versão aplicada: {data.key.items.map((i) => `${i.position}${i.key === "D" ? "(disc.)" : i.key}`).join(" · ")}. Em branco e pendente são situações diferentes: só células confirmadas entram na nota.</p>
      </section>

      <section className="card"><h2 className="mb-2 text-lg">Cartões-resposta por foto</h2>
        <p className="hint mb-3">Código impresso nos cartões desta aplicação: <code>{expectedCode}</code>. Fotografe pelo celular ou envie arquivos em lote. Cada foto vai para conferência com a imagem ao lado; leituras duvidosas nunca entram na nota sozinhas.</p>
        {!info.features.photoImport ? <p className="card-tint text-sm">Correção por foto está nos planos Professor e Escola. <Link href="/app/plano">Ver planos</Link></p> : (
          <Form action={uploadSheetsAction.bind(null, current.id)} resetOnOk>
            <div className="field"><label htmlFor="files">Fotos dos cartões</label><input id="files" name="files" type="file" accept="image/*" capture="environment" multiple className="input" /></div>
            <SubmitButton pendingLabel="Enviando…">Enviar para conferência</SubmitButton></Form>)}
        {pendingSheets.length > 0 && (
          <div className="mt-5 space-y-5">
            <h3>Para conferir ({pendingSheets.length})</h3>
            {pendingSheets.map((s) => (
              <div key={s.id} className="grid gap-4 rounded-lg border border-line p-3 md:grid-cols-[260px_1fr]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/sheet/${s.id}`} alt="Foto do cartão-resposta para conferência" className="max-h-80 w-full rounded border border-line object-contain" />
                <Form action={confirmSheetAction.bind(null, s.id)}>
                  {s.note && <p className="card-amber mb-2 text-sm">{s.note}</p>}
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="field"><label htmlFor={`st-${s.id}`}>Aluno</label><select id={`st-${s.id}`} name="studentId" className="input" required defaultValue=""><option value="" disabled>Escolha…</option>{data.students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select></div>
                    <Field label="Código impresso no cartão (opcional)" name="code" placeholder={expectedCode} />
                  </div>
                  <div className="flex flex-wrap gap-2">{data.key.items.map((it, i) => (
                    <div key={it.position} className="field mb-1"><label htmlFor={`a${it.position}-${s.id}`} className="text-xs">Q{it.position}{(s.detected?.confidence?.[i] ?? 1) < 0.8 && <span className="badge badge-amber ml-1">revisar</span>}</label>
                      <input id={`a${it.position}-${s.id}`} name={`a${it.position}`} defaultValue={s.detected?.answers?.[i] ?? ""} maxLength={it.key === "D" ? 5 : 1} className="input text-center uppercase" style={{ width: 54, minHeight: 34, padding: ".2rem" }} /></div>))}</div>
                  <div className="flex gap-3"><SubmitButton>Confirmar cartão</SubmitButton></div>
                </Form>
                <form action={rejectSheetAction.bind(null, s.id)}><button className="link-btn text-danger" type="submit">Descartar foto</button></form>
              </div>))}
          </div>)}
        {sheets.length > 0 && <p className="hint mt-3">{sheets.filter((s) => s.status === "confirmed").length} confirmado(s) · {pendingSheets.length} a conferir · {sheets.filter((s) => s.status === "rejected").length} descartado(s)/substituído(s).</p>}
      </section>

      <section className="card"><h2 className="mb-2 text-lg">Finalizar e lançar notas na turma</h2>
        <p className="hint mb-3">Mostra totais e pendências. A finalização pode ser parcial: alunos sem leitura completa ficam <strong>pendentes</strong> (não viram zero) e ausentes ficam como ausência.</p>
        <table className="t mb-4"><thead><tr><th>Aluno</th><th>Situação</th><th>Total</th></tr></thead><tbody>
          {data.rows.map((r) => <tr key={r.student.id}><td>{r.student.name}</td><td>{r.absent ? <span className="badge badge-gray">ausente</span> : r.complete ? <span className="badge">completo</span> : <span className="badge badge-amber">pendente</span>}</td><td>{r.absent ? "—" : r.complete ? r.total.toLocaleString("pt-BR") : "—"}</td></tr>)}
        </tbody></table>
        <Form action={publishGradesAction.bind(null, current.id)}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="field"><label htmlFor="period">Período</label><select id="period" name="period" className="input">{rules.periods.map((p) => <option key={p}>{p}</option>)}</select></div>
            <Field label="Peso na média" name="weight" defaultValue="1" />
          </div>
          <SubmitButton>Confirmar notas no registro da turma</SubmitButton>
        </Form>
        <p className="mt-3 text-sm"><Link href={`/app/provas/${id}/resultados?app=${current.id}`}>Ver resultados e análise por item →</Link></p>
      </section>
      <span hidden>{a.id}</span>
    </div>
  );
}
