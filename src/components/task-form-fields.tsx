import { Field } from "@/components/form";
import { QuestionBuilder } from "@/components/question-builder";
import type { TaskQuestion } from "@/db/schema";
import { toLocalSP } from "@/lib/task-access";

export function TaskFields({ t }: { t?: { title: string; description: string | null; kind: string; dueAt: Date | null; points: string; allowLate: boolean; allowResubmit: boolean; resourceUrl: string | null; questions: TaskQuestion[] } }) {
  return (
    <>
      <Field label="Título" name="title" required defaultValue={t?.title} />
      <div className="field"><label htmlFor="kind">Tipo</label><select id="kind" name="kind" className="input" defaultValue={t?.kind ?? "assignment"}><option value="assignment">Atividade / trabalho</option><option value="form">Formulário</option><option value="resource">Recurso de estudo</option></select></div>
      <div className="field"><label htmlFor="description">Orientações</label><textarea id="description" name="description" className="input" style={{ minHeight: 90 }} defaultValue={t?.description ?? ""} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="field"><label htmlFor="dueAt">Prazo</label><input id="dueAt" name="dueAt" type="datetime-local" className="input" defaultValue={toLocalSP(t?.dueAt ?? null)} /></div>
        <Field label="Pontuação (se não houver questões)" name="points" defaultValue={t ? String(Number(t.points)).replace(".", ",") : "10"} />
      </div>
      <Field label="Link do recurso (opcional)" name="resourceUrl" placeholder="https://" defaultValue={t?.resourceUrl ?? ""} />
      <label className="mb-2 flex gap-2 font-normal"><input type="checkbox" name="allowLate" defaultChecked={t?.allowLate ?? true} />Aceitar entrega após o prazo (marcada como atrasada)</label>
      <label className="mb-3 flex gap-2 font-normal"><input type="checkbox" name="allowResubmit" defaultChecked={t?.allowResubmit ?? false} />Permitir reenvio (a versão anterior fica registrada)</label>
      <QuestionBuilder initial={t?.questions ?? []} />
    </>
  );
}
