/** Regras puras do cadastro do professor (escola → disciplinas → séries e turmas). */
import { normalize } from "@/lib/taxonomy";

export type SchoolChoice =
  | { kind: "catalog"; id: string; name: string; city: string; uf: string; neighborhood?: string | null }
  | { kind: "manual"; name: string; city: string; uf: string }
  | { kind: "linked"; orgId: string; name: string }
  | { kind: "none" };

export type Draft = {
  step: 1 | 2 | 3 | 4;
  school?: SchoolChoice;
  subjects: string[];
  /** disciplina -> série -> identificações de turma (ex.: "A", "B" ou texto livre) */
  assignments: Record<string, Record<string, string[]>>;
};

export const EMPTY_DRAFT: Draft = { step: 1, subjects: [], assignments: {} };
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
export const GRADE_GROUPS = [
  { label: "Ensino Fundamental", grades: [{ value: "6", short: "6º ano" }, { value: "7", short: "7º ano" }, { value: "8", short: "8º ano" }, { value: "9", short: "9º ano" }] },
  { label: "Ensino Médio", grades: [{ value: "em1", short: "1ª série" }, { value: "em2", short: "2ª série" }, { value: "em3", short: "3ª série" }] },
];
export const LETTERS = ["A", "B", "C", "D", "E"];

/** Nome canônico da turma: "9º B", "1ª A" ou o texto digitado. */
export function className(grade: string, label: string): string {
  const t = label.trim();
  if (!t) return "";
  const prefix = grade.startsWith("em") ? `${grade.slice(2)}ª` : `${grade}º`;
  if (/^[A-Za-z]$/.test(t)) return `${prefix} ${t.toUpperCase()}`;
  return t;
}

export type Assignment = { subject: string; grade: string; name: string };

export function flatten(d: Draft): Assignment[] {
  const out: Assignment[] = [];
  for (const subject of d.subjects) {
    const byGrade = d.assignments[subject] ?? {};
    for (const [grade, labels] of Object.entries(byGrade)) {
      const seen = new Set<string>();
      for (const l of labels) {
        const name = className(grade, l);
        if (name && !seen.has(normalize(name))) { seen.add(normalize(name)); out.push({ subject, grade, name }); }
      }
    }
  }
  return out;
}

/** Erro de validação da etapa (ou null). */
export function stepProblem(d: Draft, step: 1 | 2 | 3): string | null {
  if (step === 1) {
    const s = d.school;
    if (!s) return "Escolha seu colégio na lista, informe-o manualmente ou marque que não dá aula em escola fixa.";
    if (s.kind === "manual" && (s.name.trim().length < 3 || s.city.trim().length < 2 || !UFS.includes(s.uf))) return "Informe nome, cidade e UF do colégio.";
  }
  if (step === 2 && d.subjects.length === 0) return "Escolha ao menos uma disciplina.";
  if (step === 3) {
    for (const sub of d.subjects) {
      const by = d.assignments[sub] ?? {};
      const any = Object.values(by).some((l) => l.some((x) => x.trim()));
      if (!any) return "Para cada disciplina, escolha ao menos uma série e uma turma.";
      for (const [g, labels] of Object.entries(by)) if (labels.length === 0) return `Escolha a turma do ${g.startsWith("em") ? g.slice(2) + "ª série" : g + "º ano"} ou remova a série.`;
    }
  }
  return null;
}

/** Ao mudar as disciplinas, remove associações órfãs e preserva o resto. */
export function reconcile(d: Draft): Draft {
  const assignments: Draft["assignments"] = {};
  for (const s of d.subjects) if (d.assignments[s]) assignments[s] = d.assignments[s];
  return { ...d, assignments };
}

/** Texto "Matemática · 9º A e 9º B" para o resumo. */
export function summarize(subjectName: string, names: string[]): string {
  const list = names.length <= 1 ? names.join("") : names.slice(0, -1).join(", ") + " e " + names[names.length - 1];
  return `${subjectName} · ${list}`;
}

export function parseDraft(raw: unknown): Draft {
  if (!raw || typeof raw !== "object") return { ...EMPTY_DRAFT };
  const r = raw as Partial<Draft>;
  const subjects = Array.isArray(r.subjects) ? r.subjects.filter((x): x is string => typeof x === "string").slice(0, 30) : [];
  const assignments: Draft["assignments"] = {};
  if (r.assignments && typeof r.assignments === "object") {
    for (const [s, byGrade] of Object.entries(r.assignments)) {
      if (!subjects.includes(s) || !byGrade || typeof byGrade !== "object") continue;
      assignments[s] = {};
      for (const [g, labels] of Object.entries(byGrade as object)) {
        if (!["6", "7", "8", "9", "em1", "em2", "em3"].includes(g) || !Array.isArray(labels)) continue;
        assignments[s][g] = (labels as unknown[]).filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 40)).filter(Boolean).slice(0, 12);
      }
    }
  }
  const step = r.step === 2 || r.step === 3 || r.step === 4 ? r.step : 1;
  return { step, school: r.school as SchoolChoice | undefined, subjects, assignments };
}
