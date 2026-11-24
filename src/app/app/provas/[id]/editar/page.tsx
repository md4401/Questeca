import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { loadAssessment } from "@/lib/access";
import { getItems } from "@/lib/assessments";
import { ExamEditor } from "@/components/exam-editor";
import { aiAvailable } from "@/lib/ai";

export const metadata = { title: "Editar texto da prova" };

export default async function Editar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ novo?: string; ia?: string; esc?: string; aviso?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const rows = await getItems(id);
  const esc = (t: string) => t.replace(/\{/g, "{lb}");
  if (!rows.length) return <div className="card"><p>A prova ainda não tem questões para editar.</p><div className="mt-3 flex gap-2"><Link className="btn" href="/app/provas/montar">Montar com temas</Link><Link className="btn btn-ghost" href={`/app/banco?add=${id}`}>Adicionar do banco</Link></div></div>;
  const items = rows.map((r, i) => ({
    itemId: r.item.id, number: i + 1, points: Number(r.item.points).toLocaleString("pt-BR"),
    statement: r.item.override?.statement ?? esc(r.q.statement ?? ""),
    alternatives: r.q.alternatives.map((alt) => ({ key: alt.key, text: r.item.override?.alternatives?.find((x) => x.key === alt.key)?.text ?? esc(alt.text) })),
    origStatement: esc(r.q.statement ?? ""), origAlternatives: r.q.alternatives.map((alt) => ({ key: alt.key, text: esc(alt.text) })),
    edited: !!r.item.override, ia: r.q.origin === "ia" ? { answer: r.q.answer ?? "" } : null, tema: r.q.tema ?? null,
  }));
  return (
    <div className="space-y-3">
      {sp.novo && <p className="rounded-md bg-surface-2 p-3 text-sm" role="status">{(() => { const [f, w] = sp.novo.split("-"); return Number(f) < Number(w) ? `Encontrei ${f} de ${w} questões liberadas para esses temas. Complete com “+ Questão do banco” ou “+ Questão nova”.` : `Prova montada com ${f} questões${sp.esc ? ", escolhidas pela GizIA entre as melhores do banco" : ""}${sp.ia ? `, ${sp.ia} criada(s) pela GizIA (confira enunciado e gabarito)` : ""}. Edite à vontade: enunciados, alternativas, ordem, textos e questões.`; })()}{sp.aviso ? ` ${sp.aviso}` : ""}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl">Editar texto da prova</h2><p className="hint">Mude enunciados, alternativas e instruções como num editor de texto.</p></div>
        <Link className="btn btn-ghost" href={`/app/provas/${id}/previa`}>Ver prévia e baixar arquivos</Link></div>
      <ExamEditor giz={aiAvailable() ? { permitido: !!ctx.user.prefs?.gizCriaQuestoes } : null} key={rows.map((r) => r.item.id).join("")} assessmentId={id} title={a.title} instructions={a.layout?.instructions ?? (ctx.org.settings.header?.instructions ?? null)} items={items} blocks={a.layout?.blocks ?? []} schoolName={ctx.org.settings.header?.schoolName ?? ""} />
    </div>
  );
}
