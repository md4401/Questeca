import type { QuizItem } from "@/db/schema";

export type Answers = Record<string, string | number | boolean>;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

/** Acerto de um item de correção automática; null = depende do professor (discursiva). */
export function gradeItem(it: QuizItem, ans: string | number | boolean | undefined): boolean | null {
  if (it.type === "text") return null;
  if (ans === undefined || ans === "") return false;
  if (it.type === "mc") return Number(ans) === it.answer;
  if (it.type === "tf") return (ans === true || ans === "true") === (it.answer === true) && (ans === true || ans === false || ans === "true" || ans === "false");
  if (it.type === "challenge") return Array.isArray(it.answer) && it.answer.some((a) => norm(a) === norm(String(ans)));
  return false;
}

export function scoreAttempt(items: QuizItem[], answers: Answers, manual: Record<string, number> = {}) {
  let score = 0; let max = 0; let review = false;
  const detail = items.map((it) => {
    max += it.points;
    const ok = gradeItem(it, answers[it.id]);
    let got = 0;
    if (ok === null) { if (manual[it.id] != null) got = Math.min(it.points, Math.max(0, manual[it.id])); else if (String(answers[it.id] ?? "").trim()) review = true; }
    else if (ok) got = it.points;
    score += got;
    return { id: it.id, ok, got, pending: ok === null && manual[it.id] == null && !!String(answers[it.id] ?? "").trim() };
  });
  return { score, max, pct: max === 0 ? 0 : Math.round((score / max) * 1000) / 10, review, detail };
}

export function validateQuiz(items: QuizItem[]): string | null {
  if (items.length === 0) return "Adicione ao menos uma questão.";
  for (const it of items) {
    if (!it.prompt.trim()) return "Toda questão precisa de enunciado.";
    if (!(it.points > 0)) return "Cada questão precisa valer mais que zero.";
    if (it.type === "mc") { if (!it.options || it.options.length < 2 || it.options.some((o) => !o.trim())) return "Múltipla escolha precisa de ao menos duas alternativas preenchidas."; if (typeof it.answer !== "number" || it.answer < 0 || it.answer >= it.options.length) return "Escolha a alternativa correta."; }
    if (it.type === "tf" && typeof it.answer !== "boolean") return "Informe se a afirmação é verdadeira ou falsa.";
    if (it.type === "challenge" && (!Array.isArray(it.answer) || it.answer.filter((a) => a.trim()).length === 0)) return "Informe ao menos uma resposta aceita no desafio.";
  }
  return null;
}

export type StartCheck = { ok: true; attemptNo: number; resume?: boolean } | { ok: false; reason: string };
/** Pode iniciar? Prazo, tentativas e tentativa em andamento (retoma enquanto o tempo vale). */
export function canStart(q: { status: string; dueAt: Date | null; maxAttempts: number }, attempts: { attemptNo: number; status: string; deadlineAt: Date | null }[], now: Date): StartCheck {
  if (q.status !== "published") return { ok: false, reason: q.status === "closed" ? "Este quiz foi encerrado." : "Este quiz ainda não foi publicado." };
  const open = attempts.find((a) => a.status === "in_progress" && (!a.deadlineAt || a.deadlineAt > now));
  if (open) return { ok: true, attemptNo: open.attemptNo, resume: true };
  if (q.dueAt && now > q.dueAt) return { ok: false, reason: "O prazo deste quiz terminou." };
  if (attempts.length >= q.maxAttempts) return { ok: false, reason: `Você já usou ${q.maxAttempts === 1 ? "a única tentativa" : `as ${q.maxAttempts} tentativas`}.` };
  return { ok: true, attemptNo: attempts.length + 1 };
}
export const GRACE_SECONDS = 15;
/** Envio dentro do tempo (com tolerância de rede). */
export const withinTime = (deadline: Date | null, now: Date) => !deadline || now.getTime() <= deadline.getTime() + GRACE_SECONDS * 1000;
/** Explicações liberadas? */
export const canSeeExplanations = (policy: string, dueAt: Date | null, now: Date) => policy === "after_submit" || (policy === "after_due" && !!dueAt && now > dueAt);
