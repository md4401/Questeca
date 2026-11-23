import type { Scope } from "@/db/schema";

export type QStatus = "curation" | "reference_only" | "released" | "in_review" | "blocked";

export type Candidate = {
  id: string;
  status: QStatus;
  voided: boolean;
  answer: string | null;
  statement: string | null;
  assessed: string[];
  prerequisites: string[];
  methods: string[]; // métodos alternativos válidos (slugs) que dispensam um requisito
  difficulty: number;
  estSeconds: number;
  institution: string;
  year: number;
  stimulusId?: string | null;
};

export type Verdict =
  | { ok: true; matched: string[] }
  | { ok: false; code: "integrity" | "excluded" | "out_of_scope" | "needs_confirmation"; reason: string; topics?: string[] };

export function checkIntegrity(q: Candidate): Verdict | null {
  if (q.status !== "released") return { ok: false, code: "integrity", reason: "Questão não liberada para montagem." };
  if (q.voided) return { ok: false, code: "integrity", reason: "Questão anulada." };
  if (!q.answer) return { ok: false, code: "integrity", reason: "Sem gabarito verificado." };
  if (!q.statement) return { ok: false, code: "integrity", reason: "Enunciado indisponível." };
  return null;
}

/** Regras 1–3 do PRD: integridade, conhecimento e exclusões. */
export function evaluate(q: Candidate, scope: Scope): Verdict {
  const bad = checkIntegrity(q);
  if (bad) return bad;
  const taught = new Set([...scope.willFall, ...scope.prerequisite]);
  const excluded = new Set(scope.notTaught);
  const confirm = new Set(scope.confirm);
  const needed = [...q.assessed, ...q.prerequisites];

  // Método alternativo válido dentro do escopo dispensa um conhecimento excluído.
  const altInScope = q.methods.length > 0 && q.methods.every((m) => taught.has(m) && !excluded.has(m));

  const hitsExcluded = needed.filter((s) => excluded.has(s));
  if (hitsExcluded.length && !altInScope) {
    return { ok: false, code: "excluded", reason: "Exige conteúdo marcado como “Ainda não ensinei”.", topics: hitsExcluded };
  }
  const hitsConfirm = needed.filter((s) => confirm.has(s));
  if (hitsConfirm.length) {
    return { ok: false, code: "needs_confirmation", reason: "Depende de conteúdo que precisa de confirmação.", topics: hitsConfirm };
  }
  const outside = needed.filter((s) => !taught.has(s) && !excluded.has(s));
  if (outside.length) {
    return { ok: false, code: "out_of_scope", reason: "Exige conhecimento fora do escopo confirmado.", topics: outside };
  }
  if (!q.assessed.some((s) => scope.willFall.includes(s)) && !(altInScope && hitsExcluded.length)) {
    return { ok: false, code: "out_of_scope", reason: "Não avalia nenhum conteúdo que vai cair nesta prova.", topics: q.assessed };
  }
  return { ok: true, matched: q.assessed.filter((s) => scope.willFall.includes(s)) };
}

export type RankOptions = {
  wanted: number;
  durationMin: number;
  filters?: { institutions?: string[]; yearFrom?: number; yearTo?: number; difficulty?: number[] };
  excludeIds?: string[]; // já usadas na turma ou nesta prova
  preferredInstitutions?: string[];
};

export type Pick = { id: string; reason: string; matched: string[] };

export type SelectionResult = {
  picks: Pick[];
  found: number;
  wanted: number;
  uncovered: string[];
  estimatedMinutes: number;
  rejected: { id: string; code: string; reason: string }[];
  shortfall: boolean;
};

/** Regra 4: ordena por lacunas de cobertura, fonte preferida, tempo e novidade; agrupa estímulos comuns. */
export function selectQuestions(pool: Candidate[], scope: Scope, opt: RankOptions): SelectionResult {
  const rejected: SelectionResult["rejected"] = [];
  const eligible: { q: Candidate; matched: string[] }[] = [];
  const exclude = new Set(opt.excludeIds ?? []);
  const f = opt.filters ?? {};

  for (const q of pool) {
    const v = evaluate(q, scope);
    if (!v.ok) { rejected.push({ id: q.id, code: v.code, reason: v.reason }); continue; }
    if (f.institutions?.length && !f.institutions.includes(q.institution)) continue;
    if (f.yearFrom && q.year < f.yearFrom) continue;
    if (f.yearTo && q.year > f.yearTo) continue;
    if (f.difficulty?.length && !f.difficulty.includes(q.difficulty)) continue;
    eligible.push({ q, matched: v.matched });
  }

  const budget = opt.durationMin * 60;
  const covered = new Map<string, number>();
  const picks: Pick[] = [];
  let used = 0;
  const remaining = [...eligible];
  const target = scope.willFall;

  while (picks.length < opt.wanted && remaining.length) {
    let bestIdx = -1; let bestScore = -Infinity;
    remaining.forEach((c, i) => {
      const gaps = c.matched.filter((s) => (covered.get(s) ?? 0) === 0).length;
      const preferred = opt.preferredInstitutions?.includes(c.q.institution) ? 1 : 0;
      const fresh = exclude.has(c.q.id) ? -5 : 0;
      const over = used + c.q.estSeconds > budget ? -3 : 0;
      const idealDiff = -Math.abs(c.q.difficulty - 3) * 0.25;
      const score = gaps * 10 + preferred + fresh + over + idealDiff + (target.length ? c.matched.length * 0.1 : 0);
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    });
    const [c] = remaining.splice(bestIdx, 1);
    picks.push({ id: c.q.id, matched: c.matched, reason: "" });
    used += c.q.estSeconds;
    for (const s of c.matched) covered.set(s, (covered.get(s) ?? 0) + 1);
    // agrupa itens do mesmo estímulo logo depois
    if (c.q.stimulusId) {
      for (let i = remaining.length - 1; i >= 0 && picks.length < opt.wanted; i--) {
        if (remaining[i].q.stimulusId === c.q.stimulusId) {
          const [g] = remaining.splice(i, 1);
          picks.push({ id: g.q.id, matched: g.matched, reason: "" });
          used += g.q.estSeconds;
          for (const s of g.matched) covered.set(s, (covered.get(s) ?? 0) + 1);
        }
      }
    }
  }

  const uncovered = target.filter((s) => !covered.get(s));
  return {
    picks, found: picks.length, wanted: opt.wanted, uncovered,
    estimatedMinutes: Math.round(used / 60),
    rejected, shortfall: picks.length < opt.wanted,
  };
}

/** Conflito de escopo: itens fixados cujo conhecimento passou a ser excluído. */
export function scopeConflicts(items: { id: string; q: Candidate; pinned: boolean }[], scope: Scope) {
  const out: { id: string; reason: string; topics: string[] }[] = [];
  for (const it of items) {
    const v = evaluate(it.q, scope);
    if (!v.ok && (v.code === "excluded" || v.code === "out_of_scope" || v.code === "needs_confirmation")) {
      out.push({ id: it.id, reason: v.reason, topics: v.topics ?? [] });
    }
  }
  return out;
}
