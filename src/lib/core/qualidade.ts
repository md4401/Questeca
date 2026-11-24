/** Checagem de qualidade das questões do banco (extraídas de PDFs). Questões com problema voltam para "curadoria" e não entram em provas. */
export type QuestaoQ = { statement: string | null; alternatives: { key: string; text: string }[]; answer: string | null; origin?: string | null };

export type Problema = "cabecalho-de-pagina" | "glifo-quebrado" | "enunciado-curto" | "enunciado-longo" | "alternativas-duplicadas" | "alternativa-vazia" | "alternativa-gigante" | "gabarito-invalido" | "poucas-alternativas";

const CABECALHO = /#{3,}|Concurso Vestibular|\{\s*\d{1,3}\s*\}|P[áa]gina\s+\d+\s+de\s+\d+|\bPROVA\s+V\d\b/i;

export function problemasDaQuestao(q: QuestaoQ): Problema[] {
  const out: Problema[] = [];
  const st = q.statement ?? "";
  const alts = q.alternatives ?? [];
  const extraida = !q.origin || q.origin === "banco";
  if (alts.length < 2) out.push("poucas-alternativas");
  if (CABECALHO.test(st) || alts.some((a) => CABECALHO.test(a.text))) out.push("cabecalho-de-pagina");
  if (/�/.test(st) || alts.some((a) => /�/.test(a.text))) out.push("glifo-quebrado");
  if (extraida && st.trim().length < 25) out.push("enunciado-curto");
  if (extraida && st.length > 3800) out.push("enunciado-longo");
  if (alts.some((a) => !a.text.trim())) out.push("alternativa-vazia");
  if (extraida && alts.some((a) => a.text.length > 700)) out.push("alternativa-gigante");
  const textos = alts.map((a) => a.text.replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean);
  if (new Set(textos).size < textos.length) out.push("alternativas-duplicadas");
  if (!q.answer || !alts.some((a) => a.key === q.answer)) out.push("gabarito-invalido");
  return out;
}

/** Impressão digital do enunciado + alternativas, para achar duplicatas (mesma questão em provas/ano diferentes ou extraída duas vezes). */
export function impressaoDigital(q: Pick<QuestaoQ, "statement" | "alternatives">): string {
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return n(q.statement ?? "").slice(0, 400) + "|" + q.alternatives.map((a) => n(a.text).slice(0, 60)).join("|");
}
