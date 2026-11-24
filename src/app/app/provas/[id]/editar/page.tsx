import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { loadAssessment } from "@/lib/access";
import { getItems } from "@/lib/assessments";
import { ExamEditor } from "@/components/exam-editor";

export const metadata = { title: "Editar texto da prova" };

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const rows = await getItems(id);
  const esc = (t: string) => t.replace(/\{/g, "{lb}");
  if (!rows.length) return <div className="card"><p>A prova ainda não tem questões para editar.</p><Link className="btn mt-3" href={`/app/provas/${id}`}>Voltar ao editor</Link></div>;
  const items = rows.map((r, i) => ({
    itemId: r.item.id, number: i + 1, points: Number(r.item.points).toLocaleString("pt-BR"),
    statement: r.item.override?.statement ?? esc(r.q.statement ?? ""),
    alternatives: r.q.alternatives.map((alt) => ({ key: alt.key, text: r.item.override?.alternatives?.find((x) => x.key === alt.key)?.text ?? esc(alt.text) })),
    origStatement: esc(r.q.statement ?? ""), origAlternatives: r.q.alternatives.map((alt) => ({ key: alt.key, text: esc(alt.text) })),
    edited: !!r.item.override,
  }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl">Editar texto da prova</h2><p className="hint">Mude enunciados, alternativas e instruções como num editor de texto.</p></div>
        <Link className="btn btn-ghost" href={`/app/provas/${id}/previa`}>Ver prévia e baixar arquivos</Link></div>
      <ExamEditor assessmentId={id} title={a.title} instructions={a.layout?.instructions ?? (ctx.org.settings.header?.instructions ?? null)} items={items} blocks={a.layout?.blocks ?? []} schoolName={ctx.org.settings.header?.schoolName ?? ""} />
    </div>
  );
}
