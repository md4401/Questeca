import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orgs } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { myClassesAllOrgs } from "@/lib/my-classes";
import { loadGradebook, rulesFrom, cellLabel } from "@/lib/gradebook";
import { situation } from "@/lib/core/grades";
import { PageHead } from "@/components/page-head";
import { NotasPanel } from "./panel";
import { gradeLabel, subjectLabel } from "@/lib/taxonomy";

export const metadata = { title: "Notas" };

export const SIT_LABEL = { sem_notas: "Sem notas", aprovado: "Aprovado", recuperacao: "Recuperação", reprovado: "Reprovado" } as const;
export const SIT_TONE = { sem_notas: "regular", aprovado: "regular", recuperacao: "atencao", reprovado: "risco" } as const;
const CAT: Record<string, string> = { prova: "Prova", trabalho: "Trabalho", participacao: "Participação", atividade: "Atividade", simulado: "Simulado" };
export const tone = (v: number, max: number, pass: number, scale: number) => { const n = (v / max) * scale; return n >= pass ? "ok" : n >= pass - 2 ? "att" : "bad"; };

export default async function Notas({ searchParams }: { searchParams: Promise<{ turma?: string; periodo?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const classes = await myClassesAllOrgs(ctx);
  const cls = classes.find((c) => c.id === sp.turma) ?? classes[0];
  if (!cls) {
    return (<div className="space-y-4"><PageHead icon="nota" title="Notas" sub="Consulte e gerencie as avaliações" /><section className="card empty"><p>Você ainda não tem turmas.</p><p className="mt-3"><Link className="btn" href="/app/turmas/nova">Criar turma</Link></p></section></div>);
  }
  await loadClass(ctx, cls.id);
  const [org] = await db.select({ settings: orgs.settings }).from(orgs).where(eq(orgs.id, cls.orgId)).limit(1);
  const settings = org?.settings ?? {};
  const rules = rulesFrom(settings);
  const period = rules.periods.includes(sp.periodo ?? "") ? sp.periodo! : rules.periods[0];
  const gb = await loadGradebook(cls.id, period, rules);
  const totalW = gb.items.reduce((a, i) => a + Number(i.weight), 0) || 1;
  const href = (c: string, p: string) => `/app/notas?turma=${c}&periodo=${encodeURIComponent(p)}`;
  return (
    <div className="space-y-6">
      <PageHead icon="nota" title="Notas" sub="Notas de cada turma e de cada aluno. Adicione atividades e lance as notas." actions={<a className="btn" href="#nova-avaliacao">+ Nova avaliação</a>} />

      <div className="flex flex-wrap items-end gap-3">
        <form method="get" className="flex items-end gap-2">
          <input type="hidden" name="periodo" value={period} />
          <div className="field !mb-0"><label htmlFor="turma">Turma</label>
            <select id="turma" name="turma" defaultValue={cls.id} className="input">{classes.map((c) => <option key={c.id} value={c.id}>{c.name}{ctx.orgs.length > 1 ? ` — ${c.orgName}` : ""}</option>)}</select></div>
          <button className="btn btn-ghost" type="submit">Abrir</button>
        </form>
        <nav aria-label="Período" className="flex flex-wrap gap-1">{rules.periods.map((p) => <Link key={p} href={href(cls.id, p)} className={`btn btn-sm ${p === period ? "" : "btn-ghost"}`} aria-current={p === period ? "page" : undefined}>{p}</Link>)}</nav>
      </div>

      <section className="card !p-0 overflow-hidden" aria-label={`Notas de ${cls.name}`}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3"><i className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden /><h2>{cls.name}</h2><span className="hint">{gradeLabel(cls.grade)} · {subjectLabel(cls.subject)} · {gb.items.length} avaliação(ões) · {period}</span></div>
        {gb.rows.length === 0 ? <p className="empty">Esta turma ainda não tem alunos. <Link href={`/app/turmas/${cls.id}/alunos`}>Adicionar alunos</Link></p> : (
          <div className="overflow-x-auto">
            <table className="t" data-testid="visao-notas"><thead><tr>
              <th scope="col">Aluno</th>
              {gb.items.map((i) => <th key={i.id} scope="col" className="text-center"><span title={i.title} className="block max-w-[11rem] truncate">{i.title}</span><span className="badge badge-gray mt-1 normal-case">{CAT[i.category] ?? i.category}</span><span className="mt-0.5 block text-[11px] font-normal normal-case">Peso: {Math.round((Number(i.weight) / totalW) * 100)}%</span></th>)}
              <th scope="col" className="text-center">Média</th><th scope="col" className="text-center">Situação</th></tr></thead>
              <tbody>{gb.rows.map((r) => { const sit = situation(r.computed.average, rules.passMark); return (
                <tr key={r.student.id}>
                  <td><Link href={`/app/notas/aluno/${r.student.id}?turma=${cls.id}&periodo=${encodeURIComponent(period)}`} className="font-semibold no-underline">{r.student.name}</Link><br /><span className="hint">{r.student.registration ? `RA: ${r.student.registration}` : "sem matrícula"}</span></td>
                  {r.cells.map((c, k) => { const it = gb.items[k]; const label = cellLabel(c); const num = c.value != null && (c.state === "value" || c.state === "zero") ? c.value : null; const t = num == null ? "" : tone(num, Number(it.maxPoints) || 10, rules.passMark, rules.scaleMax);
                    return <td key={c.itemId} className="text-center"><span className={t ? `grade-${t}` : "hint"}>{label || "—"}</span></td>; })}
                  <td className="text-center font-bold"><span className={r.computed.average == null ? "hint" : `grade-${tone(r.computed.average, rules.scaleMax, rules.passMark, rules.scaleMax)}`}>{r.computed.average == null ? "—" : fmt(r.computed.average)}</span>{r.computed.partial && <span className="hint"> (parcial)</span>}</td>
                  <td className="text-center"><span className="chip-status" data-s={SIT_TONE[sit]}>{SIT_LABEL[sit]}</span></td>
                </tr>); })}</tbody></table>
          </div>)}
      </section>

      <section aria-label="Lançar notas" className="space-y-3">
        <h2>Lançar notas e atividades</h2>
        <NotasPanel ctx={ctx} id={cls.id} period={period} periodHref={(p) => href(cls.id, p)} settings={settings} showPeriods={false} compact />
      </section>
    </div>
  );
}
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
