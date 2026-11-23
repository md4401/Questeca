import "server-only";
import { and, eq, gte, sql, count } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, usage, classes, orgs } from "@/db/schema";
import { PLANS, cycleStart, cycleEnd, effectiveLimits, effectivePlan, canConsume, type PlanId } from "@/lib/core/plans";

export async function getSubscription(orgId: string) {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  if (row) return row;
  const now = new Date();
  await db.insert(subscriptions).values({ orgId, plan: "free", status: "active", periodStart: now, periodEnd: new Date(now.getTime() + 365 * 864e5) }).onConflictDoNothing();
  const [r2] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  return r2;
}

export async function planInfo(orgId: string) {
  const sub = await getSubscription(orgId);
  const plan = effectivePlan({ plan: sub.plan as PlanId, status: sub.status, periodEnd: sub.periodEnd, graceUntil: sub.graceUntil });
  const limits = effectiveLimits(plan, plan === sub.plan ? sub.limits : null);
  const start = plan === "free" ? cycleStart(sub.periodStart) : cycleStart(sub.periodStart);
  const end = cycleEnd(start);
  const used = async (kind: "assembly" | "card") => {
    const [r] = await db.select({ n: count() }).from(usage).where(and(eq(usage.orgId, orgId), eq(usage.kind, kind), gte(usage.cycleStart, start)));
    return Number(r?.n ?? 0);
  };
  const [assemblies, cards] = await Promise.all([used("assembly"), used("card")]);
  const [cl] = await db.select({ n: count() }).from(classes).where(and(eq(classes.orgId, orgId), eq(classes.archived, false), eq(classes.isDemo, false)));
  return { sub, plan, limits, features: PLANS[plan].features, cycleStart: start, cycleEnd: end, used: { assemblies, cards, classes: Number(cl?.n ?? 0) } };
}

/**
 * Conta uma montagem assistida na primeira gravação bem-sucedida do rascunho (≥1 item elegível).
 * Idempotente: reabrir, trocar ou exportar a mesma prova não consome de novo.
 */
export async function consumeAssembly(orgId: string, assessmentId: string): Promise<{ ok: true; counted: boolean } | { ok: false; reason: string }> {
  const info = await planInfo(orgId);
  const exists = await db.select({ id: usage.id }).from(usage).where(and(eq(usage.orgId, orgId), eq(usage.kind, "assembly"), eq(usage.key, assessmentId))).limit(1);
  if (exists.length) return { ok: true, counted: false };
  if (!canConsume(info.used.assemblies, info.limits.assemblies)) {
    return { ok: false, reason: `Limite de ${info.limits.assemblies} montagens assistidas do ciclo atingido (renova em ${info.cycleEnd.toLocaleDateString("pt-BR")}).` };
  }
  await db.insert(usage).values({ orgId, kind: "assembly", key: assessmentId, cycleStart: info.cycleStart }).onConflictDoNothing();
  return { ok: true, counted: true };
}

/** Um cartão distinto (versão + aluno, ou hash da imagem) conta uma única vez. */
export async function consumeCard(orgId: string, key: string): Promise<{ ok: true; counted: boolean } | { ok: false; reason: string }> {
  const info = await planInfo(orgId);
  const exists = await db.select({ id: usage.id }).from(usage).where(and(eq(usage.orgId, orgId), eq(usage.kind, "card"), eq(usage.key, key))).limit(1);
  if (exists.length) return { ok: true, counted: false };
  if (!canConsume(info.used.cards, info.limits.cards)) {
    return { ok: false, reason: `Limite de ${info.limits.cards} cartões do ciclo atingido. Use o lançamento manual ou a planilha.` };
  }
  await db.insert(usage).values({ orgId, kind: "card", key, cycleStart: info.cycleStart }).onConflictDoNothing();
  return { ok: true, counted: true };
}

export async function canCreateClass(orgId: string) {
  const info = await planInfo(orgId);
  const [org] = await db.select({ kind: orgs.kind }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
  void org;
  if (info.used.classes >= info.limits.classes) {
    return { ok: false as const, reason: `Seu plano ${PLANS[info.plan].name} permite ${info.limits.classes} turma(s) ativa(s). Arquive uma turma ou mude de plano.` };
  }
  return { ok: true as const };
}

export { sql };
