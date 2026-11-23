import { requirePortal } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";
import { rulesFrom, studentGrades, cellLabel } from "@/lib/gradebook";
import { subjectLabel } from "@/lib/taxonomy";
import { fmtNum } from "@/lib/format";

export const metadata = { title: "Notas" };

export default async function PortalNotas({ searchParams }: { searchParams: Promise<{ aluno?: string; periodo?: string }> }) {
  const sp = await searchParams;
  const p = await requirePortal(sp.aluno);
  const rules = rulesFrom(p.ctx.org.settings);
  const period = rules.periods.includes(sp.periodo ?? "") ? sp.periodo! : rules.periods[0];
  const data = await Promise.all(p.classes.map(async (c) => ({ c, g: await studentGrades(c.id, p.student.id, period, rules) })));
  const q = (per: string) => `?${new URLSearchParams({ ...(p.students.length > 1 ? { aluno: p.student.id } : {}), periodo: per })}`;
  return (
    <div className="space-y-6">
      <StudentSwitch list={p.students} active={p.student.id} base="/portal/notas" />
      <h1>Notas</h1>
      <nav aria-label="Período" className="flex flex-wrap gap-2">{rules.periods.map((per) => <a key={per} href={`/portal/notas${q(per)}`} className="chip no-underline" aria-current={per === period ? "true" : undefined}>{per}</a>)}</nav>
      {data.map(({ c, g }) => (
        <section key={c.id} className="card"><h2 className="text-lg">{c.name} · {subjectLabel(c.subject)}</h2>
          {g.items.length === 0 ? <p className="mt-1 text-sm text-ink-soft">Sem avaliações neste período.</p> : (<>
            <table className="t mt-2"><thead><tr><th>Atividade</th><th>Nota</th><th>Peso</th></tr></thead><tbody>
              {g.items.map((it, i) => <tr key={it.id}><td>{it.title}</td><td>{cellLabel(g.cells[i]) || "pendente"}<span className="hint"> / {fmtNum(it.maxPoints)}</span></td><td>{fmtNum(it.weight)}</td></tr>)}
            </tbody></table>
            <p className="mt-3 font-semibold">Média do período: {g.computed.average == null ? "—" : fmtNum(g.computed.average)}{g.computed.partial && <span className="badge badge-amber ml-2">parcial</span>}</p>
            <p className="hint mt-1">Como foi calculada: {g.computed.formula}</p>
            <p className="hint">F = ausência · N = não entregue · pendente = ainda sem nota. Zero, falta e pendente não se confundem.</p></>)}
        </section>))}
    </div>
  );
}
