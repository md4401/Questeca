import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { db } from "@/db";
import { applications, assessmentVersions } from "@/db/schema";
import { Form, Field, SubmitButton } from "@/components/form";
import { registerExternalAction } from "../../../provas/actions";
import { fmtDate, todayISO } from "@/lib/format";

export const metadata = { title: "Avaliações da turma" };

export default async function Avaliacoes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const apps = await db.select({ a: applications, v: assessmentVersions.number }).from(applications).leftJoin(assessmentVersions, eq(assessmentVersions.id, applications.versionId)).where(eq(applications.classId, id)).orderBy(desc(applications.appliedOn));
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="card"><h2 className="mb-3">Avaliações aplicadas e externas</h2>
        {apps.length === 0 ? <p className="text-ink-soft">Nenhuma avaliação registrada. <Link href={`/app/provas/nova?turma=${id}`}>Criar prova</Link> ou registre uma prova existente ao lado.</p> : (
          <table className="t"><thead><tr><th>Avaliação</th><th>Data</th><th>Origem</th><th></th></tr></thead><tbody>
            {apps.map(({ a, v }) => <tr key={a.id}><td>{a.title}</td><td>{fmtDate(a.appliedOn)}</td>
              <td>{a.kind === "external" ? <span className="badge badge-gray">Externa (gabarito do professor)</span> : <span className="badge">Segunda Lousa · v{v}{a.kind === "second" ? " · 2ª chamada" : ""}</span>}</td>
              <td>{a.kind === "external" ? <Link href={`/app/turmas/${id}/avaliacoes/${a.id}`}>Corrigir</Link> : <Link href={`/app/provas/${a.assessmentId}/correcao?app=${a.id}`}>Corrigir</Link>}</td></tr>)}
          </tbody></table>)}
      </section>
      <section className="card"><h2 className="mb-2 text-lg">Registrar prova existente</h2>
        <p className="hint mb-3">Uma prova feita fora da Segunda Lousa usa o gabarito que você confirma aqui. Para discursivas use <code>D(Critério=pontos;Outro=pontos)</code>, ex.: <code>A,C,D(Conclusão=1;Justificativa=2),B</code>.</p>
        <Form action={registerExternalAction} resetOnOk>
          <input type="hidden" name="classId" value={id} />
          <Field label="Título" name="title" required /><Field label="Data de aplicação" name="appliedOn" type="date" defaultValue={todayISO()} />
          <Field label="Gabarito" name="answerKey" required placeholder="A,C,B,E" />
          <Field label="Total de pontos" name="totalPoints" defaultValue="10" />
          <Field label="Versão/caderno (opcional)" name="version" />
          <SubmitButton>Registrar avaliação externa</SubmitButton></Form>
      </section>
    </div>
  );
}
