import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { myClassesAllOrgs } from "@/lib/my-classes";
import { PageHead } from "@/components/page-head";
import { FrequenciaPanel } from "@/components/frequencia-panel";
import { PainelPedagogicoCard, podeEditarRegras } from "../escola/cards";
import { gradeLabel, subjectLabel } from "@/lib/taxonomy";

export const metadata = { title: "Frequência" };

export default async function Frequencia({ searchParams }: { searchParams: Promise<{ turma?: string; data?: string; aula?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const classes = await myClassesAllOrgs(ctx);
  const cls = classes.find((c) => c.id === sp.turma) ?? classes[0];
  if (!cls) {
    return (<div className="space-y-4"><PageHead icon="chamada" title="Frequência" sub="Lance a chamada e acompanhe a frequência dos alunos" /><section className="card empty"><p>Você ainda não tem turmas.</p><p className="mt-3"><Link className="btn" href="/app/turmas/nova">Criar turma</Link></p></section></div>);
  }
  await loadClass(ctx, cls.id);
  return (
    <div className="space-y-6">
      <PageHead icon="chamada" title="Frequência" sub="Lance a chamada e acompanhe a frequência dos alunos de cada turma." />
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="field !mb-0"><label htmlFor="turma">Turma</label>
          <select id="turma" name="turma" defaultValue={cls.id} className="input">{classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {gradeLabel(c.grade)} · {subjectLabel(c.subject)}{ctx.orgs.length > 1 ? ` — ${c.orgName}` : ""}</option>)}</select></div>
        <button className="btn btn-ghost" type="submit">Abrir</button>
      </form>
      <FrequenciaPanel ctx={ctx} cls={cls} sp={sp} hidden={{ turma: cls.id }} />
      {podeEditarRegras(ctx) && cls.orgId === ctx.org.id && <PainelPedagogicoCard ctx={ctx} />}
    </div>
  );
}
