import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { loadAssessment, loadApplication } from "@/lib/access";
import { db } from "@/db";
import { applications, responses } from "@/db/schema";
import { applicationData } from "@/lib/correction";
import { analyze } from "@/lib/core/analysis";
import { topicName } from "@/lib/taxonomy";
import { fmtNum } from "@/lib/format";

export const metadata = { title: "Resultados" };

export default async function Resultados({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ app?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  await loadAssessment(ctx, id);
  const apps = await db.select().from(applications).where(eq(applications.assessmentId, id)).orderBy(desc(applications.createdAt));
  if (!apps.length) return <div className="card"><p>Os resultados aparecem depois da aplicação e do registro de respostas.</p></div>;
  const current = apps.find((x) => x.id === sp.app) ?? apps[0];
  await loadApplication(ctx, current.id);
  const data = await applicationData(current);
  const rs = await db.select().from(responses).where(eq(responses.applicationId, current.id));
  const an = analyze(data.key.items, rs.map((r) => ({ studentId: r.studentId, position: r.position, value: r.value, status: r.status })), data.rows.filter((r) => r.absent).length, data.students.length);
  return (
    <div className="space-y-6">
      <h1 className="text-xl">Resultados — {current.title}</h1>
      <p className="hint">{an.valid} aluno(s) com leitura completa de {data.students.length} · {an.absent} ausente(s) · {an.pending} pendente(s).{an.smallSample && " Amostra pequena: interprete com cautela."}</p>
      {an.valid === 0 ? <div className="card"><p>Ainda não há respostas suficientes para a análise por item e por habilidade. Registre as respostas na aba Correção.</p><Link className="btn mt-3" href={`/app/provas/${id}/correcao?app=${current.id}`}>Ir para a correção</Link></div> : (
        <>
          <section className="card overflow-x-auto"><h2 className="mb-2 text-lg">Por questão</h2>
            <table className="t"><thead><tr><th>Questão</th><th>Conteúdo</th><th>Acertos</th><th>Erros</th><th>Em branco</th><th>% de acerto</th><th>Distribuição</th></tr></thead><tbody>
              {an.items.map((i) => <tr key={i.position}><td>Q{i.position}</td><td>{i.topics.map(topicName).join(", ") || "—"}</td><td>{i.correct}</td><td>{i.wrong}</td><td>{i.blank}</td>
                <td className={i.rate < 0.5 ? "font-bold text-danger" : ""}>{fmtNum(i.rate * 100, 0)}%</td><td className="text-sm">{Object.entries(i.dist).map(([k, n]) => `${k}:${n}`).join("  ")}</td></tr>)}
            </tbody></table></section>
          <section className="card overflow-x-auto"><h2 className="mb-2 text-lg">Por habilidade/conteúdo</h2>
            <table className="t"><thead><tr><th>Conteúdo</th><th>Itens</th><th>% de acerto</th><th>Respostas válidas</th></tr></thead><tbody>
              {an.topics.map((t) => <tr key={t.slug}><td>{topicName(t.slug)}</td><td>{t.items}</td><td className={t.rate < 0.6 ? "font-bold text-danger" : ""}>{fmtNum(t.rate * 100, 0)}%</td><td>{t.n}</td></tr>)}
            </tbody></table>
            <p className="hint mt-2">Clique nos itens da tabela acima para comparar. Indicadores mostram a quantidade válida usada no cálculo.</p></section>
          {an.attention.length > 0 && (
            <section className="card-amber"><h2 className="mb-1 text-lg">O que merece atenção</h2>
              <ul className="list-disc pl-5 text-sm">{an.attention.map((t) => <li key={t.slug}>{topicName(t.slug)}: {fmtNum(t.rate * 100, 0)}% de acerto ({t.n} respostas válidas)</li>)}</ul>
              <p className="mt-2 text-sm">Sugestão (editável): abra as respostas e compare com outros itens do mesmo conteúdo antes de decidir.</p>
              <Link className="btn mt-3" href={`/app/turmas/${current.classId}/relatorios?topics=${an.attention.map((t) => t.slug).join(",")}`}>Preparar retomada</Link></section>)}
          <p className="hint">Esta análise descreve respostas registradas; não é diagnóstico. Decisões pedagógicas permanecem com o professor.</p>
        </>)}
    </div>
  );
}
