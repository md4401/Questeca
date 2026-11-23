import { Field } from "@/components/form";
import { QuizBuilder } from "@/components/quiz-builder";
import { aiAvailable } from "@/lib/ai";
import { toLocalSP } from "@/lib/task-access";
import type { QuizItem } from "@/db/schema";

export function QuizFields({ q }: { q?: { title: string; description: string | null; dueAt: Date | null; timeLimitMin: number | null; maxAttempts: number; explanations: string; items: QuizItem[]; aiGenerated: boolean; reviewed: boolean } }) {
  return (
    <>
      <Field label="Título" name="title" required defaultValue={q?.title} />
      <div className="field"><label htmlFor="description">Descrição</label><textarea id="description" name="description" className="input" defaultValue={q?.description ?? ""} /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="field"><label htmlFor="timeLimitMin">Tempo limite (min, 0 = sem)</label><input id="timeLimitMin" name="timeLimitMin" type="number" min={0} max={300} className="input" defaultValue={q?.timeLimitMin ?? 0} /></div>
        <div className="field"><label htmlFor="maxAttempts">Tentativas</label><input id="maxAttempts" name="maxAttempts" type="number" min={1} max={10} className="input" defaultValue={q?.maxAttempts ?? 1} /></div>
        <div className="field"><label htmlFor="dueAt">Entregar até</label><input id="dueAt" name="dueAt" type="datetime-local" className="input" defaultValue={toLocalSP(q?.dueAt ?? null)} /></div>
      </div>
      <div className="field"><label htmlFor="explanations">Explicações aos alunos</label><select id="explanations" name="explanations" className="input" defaultValue={q?.explanations ?? "after_submit"}><option value="after_submit">Logo após enviar</option><option value="after_due">Só depois do prazo</option><option value="never">Nunca mostrar</option></select></div>
      <QuizBuilder initial={q?.items ?? []} aiOn={aiAvailable()} aiGenerated={q?.aiGenerated} reviewed={q?.reviewed ?? true} />
    </>
  );
}
