import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { db } from "@/db";
import { applications, responses } from "@/db/schema";
import { applicationData } from "@/lib/correction";
import { analyze, supportGroups } from "@/lib/core/analysis";
import { topicName, TOPICS } from "@/lib/taxonomy";
import { createFollowUpAction } from "../../../provas/actions";
import { fmtNum, fmtDate } from "@/lib/format";

export const metadata = { title: "Relatórios da turma" };

export default async function Relatorios({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ topics?: string; erro?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const apps = await db.select().from(applications).where(eq(applications.classId, id)).orderBy(desc(applications.appliedOn)).limit(8);
  const agg = new Map<string, { correct: number; n: number }>();
  const summaries: { title: string; date: string; valid: number }[] = [];
  const groups: { app: string; g: ReturnType<typeof supportGroups> }[] = [];
  for (const app of apps) {
    const data = await applicationData(app);
    const rs = await db.select().from(responses).where(eq(responses.applicationId, app.id));
    const an = analyze(data.key.items, rs.map((r) => ({ studentId: r.studentId, position: r.position, value: r.value, status: r.status })), data.rows.filter((r) => r.absent).length, data.students.length);
    summaries.push({ title: app.title, date: app.appliedOn, valid: an.valid });
    const g = supportGroups(data.key.items.map((i) => ({ position: i.position, key: i.key, points: i.points, topics: i.topics })), rs.map((r) => ({ studentId: r.studentId, position: r.position, value: r.value, status: r.status })), new Map(data.students.map((s) => [s.id, s.name])));
    if (g.length) groups.push({ app: app.title, g });
    for (const t of an.topics) { const cur = agg.get(t.slug) ?? { correct: 0, n: 0 }; cur.correct += t.rate * t.n; cur.n += t.n; agg.set(t.slug, cur); }
  }
  const topics = [...agg].map(([slug, v]) => ({ slug, n: v.n, rate: v.n ? v.correct / v.n : 0 })).sort((a, b) => a.rate - b.rate);
  const preselected = new Set((sp.topics ?? "").split(",").filter(Boolean));
  const retomada = createFollowUpAction.bind(null, id, "retomada");
  const checagem = createFollowUpAction.bind(null, id, "checagem");
  return (
    <div className="space-y-6">
      {sp.erro && <p className="card-danger" role="alert">{sp.erro}</p>}
      <section className="card"><h2 className="mb-2">Evidências por conteúdo</h2>
        {topics.length === 0 ? <p className="text-ink-soft">Ainda não há respostas por item registradas. Com apenas notas agregadas, a análise por conteúdo exige incluir acertos por questão. Registre respostas na aba Correção de uma prova aplicada.</p> : (
          <table className="t"><thead><tr><th>Conteúdo</th><th>% de acerto</th><th>Respostas válidas</th></tr></thead><tbody>
            {topics.map((t) => <tr key={t.slug}><td>{topicName(t.slug)}</td><td className={t.rate < 0.6 ? "font-bold text-danger" : ""}>{fmtNum(t.rate * 100, 0)}%</td><td>{t.n}</td></tr>)}</tbody></table>)}
        {summaries.length > 0 && <p className="hint mt-2">Baseado em: {summaries.map((s) => `${s.title} (${fmtDate(s.date)}, ${s.valid} válidos)`).join("; ")}.</p>}
      </section>
      <section className="card"><h2 className="mb-1">Preparar retomada ou checagem</h2>
        <p className="hint mb-3">Escolha os conteúdos. A Questeca separa itens reais do acervo por necessidade (pré-requisito e prática). Você escolhe a duração, revisa e troca as questões. Use poucos itens inéditos na checagem posterior.</p>
        <form>
          <div className="grid gap-1 md:grid-cols-2">{TOPICS.map((t) => <label key={t.slug} className="flex gap-2 font-normal"><input type="checkbox" name="topics" value={t.slug} defaultChecked={preselected.has(t.slug) || (!preselected.size && topics.some((x) => x.slug === t.slug && x.rate < 0.6))} />{t.name}</label>)}</div>
          <div className="mt-4 flex flex-wrap gap-3"><SubmitButtonForm action={retomada} label="Criar retomada (6 questões)" /><SubmitButtonForm action={checagem} label="Checagem de 3 questões curtas" ghost /></div>
        </form>
      </section>
      {groups.length > 0 && (
        <section className="card"><h2 className="mb-1">Grupos de apoio sugeridos</h2>
          <p className="hint mb-2">Sugestões temporárias e revisáveis, baseadas em respostas registradas (não são diagnóstico). Ajuste antes de usar.</p>
          {groups.slice(0, 2).map(({ app, g }) => <div key={app} className="mb-3"><p className="text-sm font-bold">{app}</p><ul className="text-sm">{g.map((x) => <li key={x.topic}>{topicName(x.topic)} ({fmtNum(x.rate * 100, 0)}% de acerto, {x.n} respostas): {x.students.join(", ")}</li>)}</ul></div>)}
        </section>)}
      <section className="card"><h2 className="mb-1">Relatório individual e documentos</h2>
        <p className="text-sm">Resumos por aluno e documentos no modelo da escola ficam em <Link href="/app/documentos">Coordenação</Link>. Eles usam apenas observações, avaliações e ações confirmadas por você.</p></section>
    </div>
  );
}

function SubmitButtonForm({ action, label, ghost }: { action: (fd: FormData) => Promise<void>; label: string; ghost?: boolean }) {
  return <SubmitButtonInner action={action} label={label} ghost={ghost} />;
}
function SubmitButtonInner({ action, label, ghost }: { action: (fd: FormData) => Promise<void>; label: string; ghost?: boolean }) {
  return <button formAction={action} className={`btn ${ghost ? "btn-ghost" : ""}`} type="submit">{label}</button>;
}
