import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { reportCards } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { Form, SubmitButton } from "@/components/form";
import { rulesFrom } from "@/lib/gradebook";
import { generateReportCardAction } from "./actions";
import { fmtDateTime } from "@/lib/format";
import { anyOf } from "@/lib/util";

export const metadata = { title: "Boletins" };
export default async function Boletins({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const roster = await classStudents(id);
  const rules = rulesFrom(ctx.org.settings);
  const issued = await db.select().from(reportCards).where(inArray(reportCards.studentId, anyOf(roster.map((s) => s.id)))).orderBy(desc(reportCards.createdAt));
  return (
    <section className="card"><h2 className="mb-1 text-lg">Boletim individual (PDF)</h2>
      <p className="hint mb-3">Reúne notas com a fórmula da média, frequência e as observações marcadas como “aparece no boletim”. O PDF emitido fica guardado como foi gerado, para imprimir ou entregar à família.</p>
      {roster.length === 0 ? <p className="text-ink-soft">Sem alunos.</p> : (
        <ul className="divide-y divide-line">{roster.map((s) => {
          const mine = issued.filter((r) => r.studentId === s.id);
          return (
            <li key={s.id} className="py-3"><div className="flex flex-wrap items-end justify-between gap-2"><strong>{s.name}</strong>
              <Form action={generateReportCardAction.bind(null, id, s.id)} toast><div className="flex items-end gap-2"><div className="field !mb-0"><label className="sr-only" htmlFor={`p-${s.id}`}>Período de {s.name}</label><select id={`p-${s.id}`} name="period" className="input">{rules.periods.map((p) => <option key={p}>{p}</option>)}</select></div><SubmitButton className="btn btn-sm">Gerar boletim</SubmitButton></div></Form></div>
              {mine.length > 0 && <ul className="mt-2 space-y-1 text-sm">{mine.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-3"><a href={`/api/boletim/${r.id}`}>{r.period} · {fmtDateTime(r.createdAt)}</a></li>)}</ul>}
            </li>);
        })}</ul>)}
    </section>
  );
}
