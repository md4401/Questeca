import "server-only";
import { and, eq, inArray, asc, desc, ne, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { questions, assessments, assessmentItems, assessmentHistory, assessmentVersions, applications, type Scope, type OrgSettings } from "@/db/schema";
import { selectQuestions, scopeConflicts, evaluate, type Candidate, type SelectionResult } from "@/lib/core/selection";
import { topicName, TOPIC_BY_SLUG } from "@/lib/taxonomy";

import { plain as plainOf } from "@/lib/core/richtext";
export type QRow = typeof questions.$inferSelect;
export const toCandidate = (q: QRow): Candidate => ({
  id: q.id, status: q.status as Candidate["status"], voided: q.voided, answer: q.answer, statement: q.statement,
  assessed: q.assessed, prerequisites: q.prerequisites, methods: q.methods, difficulty: q.difficulty, estSeconds: q.estSeconds,
  institution: q.institution, year: q.year, stimulusId: q.stimulusId,
});

export async function loadPool(subject = "matematica", orgId?: string) {
  const rows = await db.select().from(questions).where(and(eq(questions.subject, subject), orgId ? or(isNull(questions.ownerOrgId), eq(questions.ownerOrgId, orgId)) : isNull(questions.ownerOrgId)));
  return rows;
}

export async function usedQuestionIdsForClass(classId: string | null) {
  if (!classId) return [] as string[];
  const rows = await db
    .select({ qid: assessmentItems.questionId })
    .from(assessmentItems)
    .innerJoin(assessments, eq(assessments.id, assessmentItems.assessmentId))
    .where(and(eq(assessments.classId, classId), eq(assessments.status, "applied")));
  return rows.map((r) => r.qid);
}

export async function getItems(assessmentId: string) {
  return db
    .select({ item: assessmentItems, q: questions })
    .from(assessmentItems)
    .innerJoin(questions, eq(questions.id, assessmentItems.questionId))
    .where(eq(assessmentItems.assessmentId, assessmentId))
    .orderBy(asc(assessmentItems.position));
}
export type ItemRow = Awaited<ReturnType<typeof getItems>>[number];

export function explainReason(q: QRow, matched: string[]) {
  const assessed = (matched.length ? matched : q.assessed).map(topicName).join(", ");
  const pre = q.prerequisites.length ? ` Pré-requisitos: ${q.prerequisites.map(topicName).join(", ")}.` : "";
  return `Avalia ${assessed}.${pre} Dificuldade ${q.difficulty}/5 (estimada), cerca de ${Math.round(q.estSeconds / 60 * 10) / 10 || 1} min (estimado).`;
}

export function runSelection(pool: QRow[], scope: Scope, a: { wantedCount: number; durationMin: number; filters: Parameters<typeof selectQuestions>[2]["filters"] }, excludeIds: string[], keepIds: string[] = []): { result: SelectionResult; byId: Map<string, QRow> } {
  const byId = new Map(pool.map((q) => [q.id, q]));
  const cands = pool.filter((q) => !keepIds.includes(q.id)).map(toCandidate);
  const result = selectQuestions(cands, scope, {
    wanted: Math.max(0, a.wantedCount - keepIds.length), durationMin: a.durationMin, filters: a.filters, excludeIds,
    preferredInstitutions: ["Inep", "Etec", "Fuvest", "Comvest"],
  });
  return { result, byId };
}

/** Distribui a pontuação total igualmente entre itens (arredondando em centésimos). */
export function evenPoints(total: number, n: number) {
  if (!n) return [];
  const base = Math.floor((total / n) * 100) / 100;
  const arr = Array(n).fill(base) as number[];
  let rest = Math.round((total - base * n) * 100);
  for (let i = 0; rest > 0; i = (i + 1) % n, rest--) arr[i] = Math.round((arr[i] + 0.01) * 100) / 100;
  return arr;
}

export async function pushHistory(assessmentId: string, label: string) {
  const [a] = await db.select().from(assessments).where(eq(assessments.id, assessmentId)).limit(1);
  if (!a) return;
  const items = await getItems(assessmentId);
  const snapshot = {
    title: a.title, scope: a.scope, totalPoints: a.totalPoints, durationMin: a.durationMin,
    items: items.map((i) => ({ questionId: i.item.questionId, position: i.item.position, points: i.item.points, pinned: i.item.pinned, reason: i.item.reason, manual: i.item.manual, scopeAck: i.item.scopeAck })),
  };
  const rev = a.revision + 1;
  await db.insert(assessmentHistory).values({ assessmentId, revision: a.revision, snapshot, label });
  await db.update(assessments).set({ revision: rev, updatedAt: new Date() }).where(eq(assessments.id, assessmentId));
}

type HistSnapshot = { title: string; scope: Scope; totalPoints: string; durationMin: number; items: { questionId: string; position: number; points: string; pinned: boolean; reason: string | null; manual: boolean; scopeAck: boolean }[] };

export async function restoreHistory(assessmentId: string, historyId: string) {
  const [h] = await db.select().from(assessmentHistory).where(and(eq(assessmentHistory.id, historyId), eq(assessmentHistory.assessmentId, assessmentId))).limit(1);
  if (!h) return false;
  await pushHistory(assessmentId, "Antes de restaurar");
  const s = h.snapshot as HistSnapshot;
  await db.delete(assessmentItems).where(eq(assessmentItems.assessmentId, assessmentId));
  if (s.items.length) await db.insert(assessmentItems).values(s.items.map((i) => ({ assessmentId, questionId: i.questionId, position: i.position, points: i.points, pinned: i.pinned, reason: i.reason, manual: i.manual, scopeAck: i.scopeAck })));
  await db.update(assessments).set({ title: s.title, scope: s.scope, totalPoints: s.totalPoints, durationMin: s.durationMin, updatedAt: new Date() }).where(eq(assessments.id, assessmentId));
  return true;
}

export async function lastHistory(assessmentId: string) {
  const [h] = await db.select().from(assessmentHistory).where(eq(assessmentHistory.assessmentId, assessmentId)).orderBy(desc(assessmentHistory.createdAt)).limit(1);
  return h;
}

export async function renumber(assessmentId: string) {
  const items = await db.select().from(assessmentItems).where(eq(assessmentItems.assessmentId, assessmentId)).orderBy(asc(assessmentItems.position));
  for (let i = 0; i < items.length; i++) if (items[i].position !== i + 1) await db.update(assessmentItems).set({ position: i + 1 }).where(eq(assessmentItems.id, items[i].id));
}

/** Mapa da prova: cobertura por conteúdo, área, formato e alertas. */
export function buildMap(items: ItemRow[], a: { scope: Scope; totalPoints: string; durationMin: number }) {
  const byTopic = new Map<string, number>();
  const byArea = new Map<string, number>();
  let seconds = 0; let points = 0;
  const format = { multipla: 0, discursiva: 0 };
  for (const { item, q } of items) {
    for (const s of q.assessed) {
      byTopic.set(s, (byTopic.get(s) ?? 0) + 1);
      const area = TOPIC_BY_SLUG.get(s)?.area ?? "Outros";
      byArea.set(area, (byArea.get(area) ?? 0) + 1);
    }
    seconds += q.estSeconds; points += Number(item.points);
    if (q.alternatives.length) format.multipla++; else format.discursiva++;
  }
  const alerts: string[] = [];
  const uncovered = a.scope.willFall.filter((s) => !byTopic.has(s));
  if (uncovered.length) alerts.push(`Metas descobertas: ${uncovered.map(topicName).join(", ")}.`);
  if (items.length && Math.abs(points - Number(a.totalPoints)) > 0.009) alerts.push(`A soma dos pontos (${points.toFixed(2).replace(".", ",")}) difere do total da prova (${Number(a.totalPoints).toFixed(2).replace(".", ",")}).`);
  const minutes = Math.round(seconds / 60);
  if (minutes > a.durationMin) alerts.push(`Duração estimada (${minutes} min) acima do planejado (${a.durationMin} min).`);
  return { byTopic, byArea, minutes, points, format, alerts, uncovered };
}

export async function conflictsFor(assessmentId: string, scope: Scope) {
  const items = await getItems(assessmentId);
  const list = scopeConflicts(items.map((i) => ({ id: i.item.id, q: toCandidate(i.q), pinned: i.item.pinned })), scope);
  return list.filter((c) => !items.find((i) => i.item.id === c.id)?.item.scopeAck);
}

/** Alternativas de troca: até 3, com diferença concreta e mudança prevista no mapa. */
export async function swapAlternatives(assessmentId: string, itemId: string, a: typeof assessments.$inferSelect) {
  const items = await getItems(assessmentId);
  const current = items.find((i) => i.item.id === itemId);
  if (!current) return [];
  const pool = await loadPool(current.q.subject, a.orgId);
  const taken = new Set(items.map((i) => i.q.id));
  const scope = a.scope;
  const cands = pool.filter((q) => !taken.has(q.id) && evaluate(toCandidate(q), scope).ok);
  const ranked = cands.map((q) => {
    const sameTopic = q.assessed.filter((s) => current.q.assessed.includes(s)).length;
    const diff = Math.abs(q.difficulty - current.q.difficulty);
    return { q, score: sameTopic * 3 - diff };
  }).sort((x, y) => y.score - x.score).slice(0, 3);
  return ranked.map(({ q }) => {
    const lost = current.q.assessed.filter((s) => !q.assessed.includes(s));
    const gained = q.assessed.filter((s) => !current.q.assessed.includes(s));
    const parts: string[] = [];
    if (q.difficulty !== current.q.difficulty) parts.push(`dificuldade ${q.difficulty > current.q.difficulty ? "maior" : "menor"} (${q.difficulty} vs ${current.q.difficulty})`);
    if (q.estSeconds !== current.q.estSeconds) parts.push(`${Math.round((q.estSeconds - current.q.estSeconds) / 60 * 10) / 10 > 0 ? "+" : ""}${Math.round((q.estSeconds - current.q.estSeconds) / 60 * 10) / 10} min`);
    if (lost.length) parts.push(`sai da cobertura: ${lost.map(topicName).join(", ")}`);
    if (gained.length) parts.push(`entra na cobertura: ${gained.map(topicName).join(", ")}`);
    return { q, diff: parts.join(" · ") || "mesmo conteúdo e dificuldade" };
  });
}

/** Snapshot imutável (versão de aplicação). */
export async function buildSnapshot(a: typeof assessments.$inferSelect, settings: OrgSettings) {
  const items = await getItems(a.id);
  return {
    title: a.title, scope: a.scope, totalPoints: a.totalPoints, durationMin: a.durationMin, header: { ...(settings.header ?? {}), ...(a.layout?.instructions != null ? { instructions: plainOf(a.layout.instructions) } : {}) },
    instructionsRich: a.layout?.instructions ?? null,
    blocks: (a.layout?.blocks ?? []).filter((b) => b.text.trim()).map((b) => ({ id: b.id, beforePosition: b.beforeItemId ? (items.find((x) => x.item.id === b.beforeItemId)?.item.position ?? null) : null, text: b.text })),
    items: items.map((i) => ({
      position: i.item.position, questionId: i.q.id, points: i.item.points, title: i.q.title, statement: i.q.statement, alternatives: i.q.alternatives,
      answer: i.q.answer, institution: i.q.institution, exam: i.q.exam, year: i.q.year, booklet: i.q.booklet, number: i.q.number, page: i.q.page, sourceUrl: i.q.sourceUrl,
      itemId: i.item.id, rich: i.item.override ? { statement: i.item.override.statement ?? null, alternatives: i.item.override.alternatives ?? null } : null,
      assessed: i.q.assessed, prerequisites: i.q.prerequisites, difficulty: i.q.difficulty, estSeconds: i.q.estSeconds, reason: i.item.reason, stimulusId: i.q.stimulusId,
    })),
  };
}
export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;

export async function latestVersion(assessmentId: string) {
  const [v] = await db.select().from(assessmentVersions).where(eq(assessmentVersions.assessmentId, assessmentId)).orderBy(desc(assessmentVersions.number)).limit(1);
  return v;
}

/** Cria nova versão se o conteúdo mudou desde a última; retorna a versão vigente. */
export async function ensureVersion(a: typeof assessments.$inferSelect, settings: OrgSettings) {
  const snap = await buildSnapshot(a, settings);
  const last = await latestVersion(a.id);
  const strip = (s: Snapshot) => JSON.stringify({ ...s, header: undefined });
  if (last && strip(last.snapshot as Snapshot) === strip(snap) && JSON.stringify((last.snapshot as Snapshot).header) === JSON.stringify(snap.header)) return last;
  const [v] = await db.insert(assessmentVersions).values({ assessmentId: a.id, number: (last?.number ?? 0) + 1, snapshot: snap }).returning();
  return v;
}

export async function versionApplications(versionId: string) {
  return db.select().from(applications).where(eq(applications.versionId, versionId));
}

export async function otherAssessmentsFor(classId: string, excludeId: string) {
  return db.select().from(assessments).where(and(eq(assessments.classId, classId), ne(assessments.id, excludeId)));
}

export { inArray };
