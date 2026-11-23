import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { descriptiveOpinions } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { Form, SubmitButton } from "@/components/form";
import { generateOpinionsAction, saveOpinionAction } from "./actions";
import { MONTHS, periodLabel, validPeriod } from "@/lib/opinions";
import { todayISO } from "@/lib/format";
import { aiAvailable } from "@/lib/ai";

export const metadata = { title: "Pareceres descritivos" };

export default async function Pareceres({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const cur = todayISO().slice(0, 7);
  const period = validPeriod(sp.mes ?? "") ? sp.mes! : cur;
  const months = Array.from({ length: 8 }, (_, i) => { const d = new Date(`${cur}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7); });
  if (!months.includes(period)) months.push(period);
  const studs = await classStudents(id);
  const ops = new Map((await db.select().from(descriptiveOpinions).where(and(eq(descriptiveOpinions.classId, id), eq(descriptiveOpinions.period, period)))).map((o) => [o.studentId, o]));
  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="mb-1 text-lg">Parecer descritivo automático</h2>
        <p className="hint mb-3">Usa os registros rápidos e observações do mês, a frequência e as notas para redigir um rascunho por aluno. {aiAvailable() ? "Redação com apoio de IA." : "Redação por modelo."} Nada é inventado e nada vai à família sem a sua aprovação.</p>
        <form method="get" className="mb-3 flex flex-wrap items-end gap-3">
          <div className="field !mb-0"><label htmlFor="mes">Mês</label><select id="mes" name="mes" defaultValue={period} className="input">{months.map((m) => <option key={m} value={m}>{MONTHS[Number(m.slice(5, 7)) - 1]} de {m.slice(0, 4)}</option>)}</select></div>
          <button className="btn btn-ghost" type="submit">Abrir</button>
        </form>
        <Form action={generateOpinionsAction.bind(null, id)} toast>
          <input type="hidden" name="period" value={period} />
          <SubmitButton pendingLabel="Gerando rascunhos…">Gerar rascunhos de {periodLabel(period)}</SubmitButton>
        </Form>
        {ops.size > 0 && <p className="mt-3"><a className="link-btn" href={`/api/export/pareceres?turma=${id}&mes=${period}`}>Baixar todos em Word (.docx)</a></p>}
      </section>
      {studs.length === 0 ? <p className="text-ink-soft">Cadastre alunos primeiro.</p> : (
        <ul className="space-y-3">
          {studs.map((s) => { const o = ops.get(s.id); return (
            <li key={s.id} className="card" data-testid="parecer-item">
              <div className="mb-1 flex flex-wrap items-center gap-2"><strong>{s.name}</strong>
                {o ? <span className={`badge ${o.status === "approved" ? "badge-gray" : "badge-amber"}`}>{o.status === "approved" ? "Aprovado" : "Rascunho"}</span> : <span className="hint">sem parecer</span>}
                {o?.origin === "ia" && <span className="hint">gerado com IA</span>}</div>
              <Form action={saveOpinionAction.bind(null, id, s.id, period)} toast>
                <label className="sr-only" htmlFor={`t-${s.id}`}>Parecer de {s.name}</label>
                <textarea id={`t-${s.id}`} name="text" className="input" rows={4} defaultValue={o?.text ?? ""} placeholder="Gere os rascunhos ou escreva o parecer aqui." />
                <div className="mt-2 flex gap-2"><button className="btn btn-ghost btn-sm" type="submit" name="intent" value="draft">Salvar rascunho</button><button className="btn btn-sm" type="submit" name="intent" value="approve">Aprovar</button></div>
              </Form>
            </li>); })}
        </ul>)}
    </div>
  );
}
