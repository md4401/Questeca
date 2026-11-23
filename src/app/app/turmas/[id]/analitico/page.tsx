import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { classAnalytics } from "@/lib/analytics";
import { rulesFrom } from "@/lib/gradebook";
import { distribution } from "@/lib/core/analytics";
import { fmtNum } from "@/lib/format";

export const metadata = { title: "Painel pedagógico" };
const LEVEL = { ok: ["Sem alerta", ""], atencao: ["Atenção", "badge-amber"], alerta: ["Alerta", "badge-amber"], sem_dados: ["Sem dados", "badge-gray"] } as const;

export default async function Analitico({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ periodo?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const periods = rulesFrom(ctx.org.settings).periods;
  const period = periods.includes(sp.periodo ?? "") ? sp.periodo! : periods[0];
  const a = await classAnalytics(id, ctx.org.settings, period);
  const vals = a.rows.map((r) => r.average).filter((v): v is number => v != null);
  const dist = distribution(vals, a.rules.scaleMax);
  const maxN = Math.max(1, ...dist.map((d) => d.n));
  return (
    <div className="space-y-6">
      <nav aria-label="Período" className="flex flex-wrap gap-2">{periods.map((p) => <Link key={p} href={`/app/turmas/${id}/analitico?periodo=${encodeURIComponent(p)}`} className="chip no-underline" aria-current={p === period ? "true" : undefined}>{p}</Link>)}</nav>
      <p className="card-tint text-sm">Os sinais abaixo são <strong>apoio</strong> e seguem os limites configurados pela escola ({a.th.minAttendance}% de frequência, média {fmtNum(a.th.minAverage)}). Não são diagnóstico: a decisão sobre qualquer medida é do professor e da coordenação. Para o acerto por questão e habilidade, veja os resultados de cada <Link href={`/app/turmas/${id}/avaliacoes`}>avaliação</Link>.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card"><h2 className="mb-2 text-lg">Distribuição das médias — {period}</h2>
          {vals.length === 0 ? <p className="text-sm text-ink-soft">Sem médias calculadas neste período.</p> : <ul className="space-y-1" aria-label="Distribuição">{dist.map((d) => <li key={d.from} className="flex items-center gap-2 text-sm"><span className="w-20 shrink-0 mono text-xs">{fmtNum(d.from, 1)}–{fmtNum(d.to, 1)}</span><span className="h-4 rounded bg-brand" style={{ width: `${(d.n / maxN) * 100}%`, minWidth: d.n ? 6 : 0 }} /><span>{d.n}</span></li>)}</ul>}</section>
        <section className="card"><h2 className="mb-2 text-lg">Evolução da média da turma</h2>
          <ul className="space-y-1 text-sm">{a.evolution.map((e) => <li key={e.period} className="flex items-center gap-2"><span className="w-28 shrink-0">{e.period}</span><span className="h-4 rounded bg-sky" style={{ width: `${((e.avg ?? 0) / a.rules.scaleMax) * 100}%`, minWidth: e.avg ? 6 : 0 }} /><span>{e.avg == null ? "—" : fmtNum(e.avg)} <span className="hint">({e.n} aluno(s))</span></span></li>)}</ul></section>
      </div>
      <section className="card"><h2 className="mb-2 text-lg">Alunos</h2>
        {a.rows.length === 0 ? <p className="text-ink-soft">Sem alunos.</p> : (
          <table className="t"><thead><tr><th>Aluno</th><th>Média</th><th>Frequência</th><th>Sinal</th></tr></thead><tbody>
            {a.rows.map((r) => (
              <tr key={r.student.id}><td>{r.student.name}</td>
                <td title={r.formula}>{r.average == null ? "—" : fmtNum(r.average)}{r.partial && <span className="hint"> parcial</span>}</td>
                <td>{r.attendance.pct == null ? "—" : `${String(r.attendance.pct).replace(".", ",")}%`}</td>
                <td><span className={`badge ${LEVEL[r.risk.level][1]}`}>{LEVEL[r.risk.level][0]}</span>{r.risk.level !== "ok" && <ul className="mt-1 text-xs text-ink-soft">{r.risk.reasons.map((x) => <li key={x}>{x}</li>)}</ul>}{(r.risk.level === "atencao" || r.risk.level === "alerta") && <Link className="link-btn text-xs" href={`/app/turmas/${id}/observacoes`}>Registrar observação</Link>}</td></tr>))}
          </tbody></table>)}
      </section>
    </div>
  );
}
