import type { TaskQuestion } from "@/db/schema";

export type TaskLike = { status: string; dueAt: Date | null; allowLate: boolean; allowResubmit: boolean };
export type SubLike = { status: string; submittedAt: Date | null; grade: string | number | null } | null;

export type StudentTaskStatus = "pendente" | "rascunho" | "entregue" | "entregue_atrasada" | "atrasada" | "corrigida";
export const TASK_STATUS_LABEL: Record<StudentTaskStatus, string> = { pendente: "Pendente", rascunho: "Rascunho", entregue: "Entregue", entregue_atrasada: "Entregue com atraso", atrasada: "Atrasada (não entregue)", corrigida: "Corrigida" };

/** Estado exibido ao aluno/responsável. "Atrasada" é só prazo vencido sem entrega: nunca vira nota sozinha. */
export function studentStatus(t: TaskLike, s: SubLike, now: Date): StudentTaskStatus {
  if (s?.status === "graded") return "corrigida";
  if (s?.status === "late") return "entregue_atrasada";
  if (s?.status === "submitted") return "entregue";
  const overdue = !!t.dueAt && now > t.dueAt;
  if (s?.status === "draft") return overdue ? "atrasada" : "rascunho";
  return overdue ? "atrasada" : "pendente";
}

export type CanSubmit = { ok: true; late: boolean } | { ok: false; reason: string };
export function canSubmit(t: TaskLike, s: SubLike, now: Date): CanSubmit {
  if (t.status === "draft") return { ok: false, reason: "Esta tarefa ainda não foi publicada." };
  if (t.status === "closed") return { ok: false, reason: "Esta tarefa foi encerrada." };
  const already = s && (s.status === "submitted" || s.status === "late" || s.status === "graded");
  if (already && !t.allowResubmit) return { ok: false, reason: "Você já entregou esta tarefa." };
  if (s?.status === "graded" && t.allowResubmit) return { ok: false, reason: "Esta tarefa já foi corrigida." };
  const late = !!t.dueAt && now > t.dueAt;
  if (late && !t.allowLate) return { ok: false, reason: "O prazo terminou e a tarefa não aceita entregas atrasadas." };
  return { ok: true, late };
}

/** Correção automática só de múltipla escolha. Questões discursivas ficam para o professor. */
export function autoScore(questions: TaskQuestion[], answers: Record<string, string | number>) {
  let score = 0; let auto = 0; let manual = 0;
  for (const q of questions) {
    if (q.type !== "mc" || q.answer == null) { manual += q.points; continue; }
    auto += q.points;
    if (Number(answers[q.id]) === q.answer) score += q.points;
  }
  return { score, auto, manual, needsReview: manual > 0 };
}

export function validateQuestions(qs: TaskQuestion[]): string | null {
  for (const q of qs) {
    if (!q.prompt.trim()) return "Toda questão precisa de enunciado.";
    if (!(q.points > 0)) return "Cada questão precisa valer mais que zero.";
    if (q.type === "mc") {
      if (!q.options || q.options.length < 2 || q.options.some((o) => !o.trim())) return "Questão de múltipla escolha precisa de ao menos duas alternativas preenchidas.";
      if (q.answer == null || q.answer < 0 || q.answer >= q.options.length) return "Escolha a alternativa correta de cada questão de múltipla escolha.";
    }
  }
  return null;
}
