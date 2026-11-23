export type PlanId = "free" | "teacher" | "school";

export const PLANS: Record<PlanId, {
  name: string; priceCents: number | null; assemblies: number; classes: number; cards: number;
  features: { word: boolean; second: boolean; photoImport: boolean; advancedReports: boolean };
  blurb: string;
}> = {
  free: { name: "Gratuito", priceCents: 0, assemblies: 3, classes: 1, cards: 40, features: { word: false, second: false, photoImport: false, advancedReports: false }, blurb: "Para preparar as primeiras provas." },
  teacher: { name: "Professor", priceCents: 3990, assemblies: 30, classes: 12, cards: 350, features: { word: true, second: true, photoImport: true, advancedReports: true }, blurb: "Várias turmas e avaliações frequentes." },
  school: { name: "Escola", priceCents: null, assemblies: 10_000, classes: 10_000, cards: 100_000, features: { word: true, second: true, photoImport: true, advancedReports: true }, blurb: "Coordenação, professores e gestão institucional." },
};

export type Limits = { assemblies: number; classes: number; cards: number };

export function effectiveLimits(plan: PlanId, override?: Partial<Limits> | null): Limits {
  const p = PLANS[plan];
  return { assemblies: override?.assemblies ?? p.assemblies, classes: override?.classes ?? p.classes, cards: override?.cards ?? p.cards };
}

/** Ciclo mensal a partir da data de início da assinatura. */
export function cycleStart(periodStart: Date, now = new Date()) {
  const s = new Date(periodStart);
  let start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), s.getUTCDate()));
  if (start > now) start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, s.getUTCDate()));
  return start;
}

export function cycleEnd(start: Date) {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()));
}

export function canConsume(used: number, limit: number, amount = 1) {
  return used + amount <= limit;
}

/** Plano efetivo considerando status: pagamento atrasado volta ao gratuito após a carência. */
export function effectivePlan(sub: { plan: PlanId; status: string; periodEnd: Date; graceUntil?: Date | null }, now = new Date()): PlanId {
  if (sub.plan === "free") return "free";
  if (sub.status === "active" || sub.status === "canceling") return sub.periodEnd > now ? sub.plan : "free";
  if (sub.status === "past_due") return sub.graceUntil && sub.graceUntil > now ? sub.plan : "free";
  return "free";
}

export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
