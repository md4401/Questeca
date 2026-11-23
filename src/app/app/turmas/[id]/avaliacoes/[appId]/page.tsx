import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { loadApplication } from "@/lib/access";
import { applicationData } from "@/lib/correction";
import { ResponseGrid } from "@/components/response-grid";
import { Form, Field, SubmitButton } from "@/components/form";
import { publishGradesAction } from "../../../../provas/correcao-actions";
import { rulesFrom } from "@/lib/gradebook";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Correção — avaliação externa" };

export default async function ExternalCorrection({ params }: { params: Promise<{ id: string; appId: string }> }) {
  const { id, appId } = await params;
  const ctx = await requireCtx();
  const { app } = await loadApplication(ctx, appId);
  const data = await applicationData(app);
  const rules = rulesFrom(ctx.org.settings);
  return (
    <div className="space-y-6">
      <p className="hint"><Link href={`/app/turmas/${id}/avaliacoes`}>← Avaliações</Link></p>
      <h2>{app.title} <span className="badge badge-gray">externa</span></h2>
      <p className="hint">{fmtDate(app.appliedOn)} · gabarito confirmado pelo professor: {data.key.items.map((i) => `${i.position}${i.key === "D" ? "(disc.)" : i.key}`).join(" · ")}</p>
      {data.key.items.some((i) => i.rubric) && <div className="card-tint text-sm"><strong>Rubricas:</strong> {data.key.items.filter((i) => i.rubric).map((i) => `Q${i.position}: ${i.rubric!.map((c) => `${c.name} (${c.points})`).join(", ")}`).join(" · ")}. Lance a pontuação total de cada discursiva (máximo = soma dos critérios).</div>}
      <ResponseGrid key={app.id} appId={app.id} items={data.key.items.map((i) => ({ position: i.position, key: i.key, points: i.points, rubric: i.rubric }))}
        rows={data.rows.map((r) => ({ studentId: r.student.id, name: r.student.name, absent: r.absent, cells: Object.fromEntries(r.cells.filter((c) => c.value !== "").map((c) => [c.position, c.value])), total: r.total, complete: r.complete }))} />
      <section className="card"><h2 className="mb-2 text-lg">Lançar notas na turma</h2>
        <Form action={publishGradesAction.bind(null, app.id)}>
          <div className="grid gap-3 md:grid-cols-3"><div className="field"><label htmlFor="period">Período</label><select id="period" name="period" className="input">{rules.periods.map((p) => <option key={p}>{p}</option>)}</select></div><Field label="Peso" name="weight" defaultValue="1" /></div>
          <SubmitButton>Confirmar notas</SubmitButton></Form></section>
    </div>
  );
}
