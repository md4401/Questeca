import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, invoices, billingEvents, memberships } from "@/db/schema";
import { env } from "@/lib/env";
import { notify } from "@/lib/audit";
import { PLANS } from "@/lib/core/plans";

export type ProviderName = "stripe" | "mock" | "none";
export function providerName(): ProviderName {
  const p = process.env.BILLING_PROVIDER;
  if (p === "stripe" && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PROFESSOR) return "stripe";
  if (p === "mock" && process.env.NODE_ENV !== "production") return "mock";
  if (p === "mock" && process.env.ALLOW_MOCK_BILLING === "1") return "mock";
  return "none";
}

const stripe = async (path: string, body?: Record<string, string>, method = "POST") => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message ?? `Stripe ${res.status}`);
  return j;
};

/** Inicia a contratação do plano Professor. Mock ativa direto (somente fora de produção). */
export async function startCheckout(orgId: string, email: string): Promise<{ url: string } | { activated: true } | { error: string }> {
  const prov = providerName();
  if (prov === "none") return { error: "O pagamento online ainda não está disponível neste ambiente. Solicite a contratação e entraremos em contato." };
  if (prov === "mock") {
    const now = new Date();
    await db.update(subscriptions).set({ plan: "teacher", status: "active", periodStart: now, periodEnd: new Date(now.getTime() + 30 * 864e5), cancelAtPeriodEnd: false, graceUntil: null, provider: "mock", limits: null }).where(eq(subscriptions.orgId, orgId));
    await db.insert(invoices).values({ orgId, amountCents: PLANS.teacher.priceCents!, status: "paid", description: "Plano Professor — mensal (teste)" });
    return { activated: true };
  }
  const s = await stripe("checkout/sessions", {
    mode: "subscription", "line_items[0][price]": process.env.STRIPE_PRICE_PROFESSOR!, "line_items[0][quantity]": "1",
    customer_email: email, client_reference_id: orgId, "subscription_data[metadata][orgId]": orgId,
    success_url: `${env.appUrl()}/app/plano?ok=1`, cancel_url: `${env.appUrl()}/app/plano?cancel=1`, locale: "pt-BR",
    // chave de idempotência por org evita sessões duplicadas em cliques repetidos
  });
  return { url: s.url as string };
}

export async function cancelAtPeriodEnd(orgId: string) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  if (!sub || sub.plan === "free") return;
  if (sub.provider === "stripe" && sub.providerRef) await stripe(`subscriptions/${sub.providerRef}`, { cancel_at_period_end: "true" });
  await db.update(subscriptions).set({ cancelAtPeriodEnd: true, status: "canceling" }).where(eq(subscriptions.orgId, orgId));
}

export async function reactivate(orgId: string) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  if (!sub || !sub.cancelAtPeriodEnd) return; // reativar sem duplicar assinatura/cobrança
  if (sub.provider === "stripe" && sub.providerRef) await stripe(`subscriptions/${sub.providerRef}`, { cancel_at_period_end: "false" });
  await db.update(subscriptions).set({ cancelAtPeriodEnd: false, status: "active" }).where(eq(subscriptions.orgId, orgId));
}

export function verifyStripeSignature(payload: string, header: string, secret: string, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.t; const v1 = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !v1.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return v1.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

/** Processa eventos de forma idempotente: o mesmo evento nunca duplica benefício ou fatura. */
export async function handleStripeEvent(ev: StripeEvent) {
  const inserted = await db.insert(billingEvents).values({ id: ev.id, type: ev.type, payload: ev as unknown as object }).onConflictDoNothing().returning({ id: billingEvents.id });
  if (!inserted.length) return { duplicate: true };
  const o = ev.data.object as Record<string, any>;  
  const orgIdOf = async (): Promise<string | null> => {
    if (o.client_reference_id) return String(o.client_reference_id);
    if (o.metadata?.orgId) return String(o.metadata.orgId);
    const ref = String(o.subscription ?? o.id ?? "");
    if (ref) { const [s] = await db.select().from(subscriptions).where(eq(subscriptions.providerRef, ref)).limit(1); if (s) return s.orgId; }
    return null;
  };
  const orgId = await orgIdOf();
  if (!orgId) return { ignored: true };
  const owner = async () => (await db.select({ u: memberships.userId }).from(memberships).where(eq(memberships.orgId, orgId)).limit(1))[0]?.u;
  switch (ev.type) {
    case "checkout.session.completed": {
      const now = new Date();
      await db.update(subscriptions).set({ plan: "teacher", status: "active", provider: "stripe", providerRef: String(o.subscription ?? ""), periodStart: now, periodEnd: new Date(now.getTime() + 31 * 864e5), cancelAtPeriodEnd: false, graceUntil: null, limits: null }).where(eq(subscriptions.orgId, orgId));
      const u = await owner(); if (u) await notify(u, "pagamento", "Pagamento confirmado", "Seu plano Professor está ativo.", "/app/plano");
      break;
    }
    case "invoice.paid": {
      const end = o.lines?.data?.[0]?.period?.end; const start = o.lines?.data?.[0]?.period?.start;
      await db.update(subscriptions).set({ status: "active", graceUntil: null, ...(end ? { periodEnd: new Date(end * 1000) } : {}), ...(start ? { periodStart: new Date(start * 1000) } : {}) }).where(eq(subscriptions.orgId, orgId));
      await db.insert(invoices).values({ orgId, amountCents: Number(o.amount_paid ?? 0), status: "paid", description: "Plano Professor — mensal" });
      break;
    }
    case "invoice.payment_failed": {
      await db.update(subscriptions).set({ status: "past_due", graceUntil: new Date(Date.now() + 7 * 864e5) }).where(eq(subscriptions.orgId, orgId));
      await db.insert(invoices).values({ orgId, amountCents: Number(o.amount_due ?? 0), status: "failed", description: "Falha no pagamento" });
      const u = await owner(); if (u) await notify(u, "pagamento", "Falha no pagamento", "Atualize a forma de pagamento. Você tem 7 dias de regularização.", "/app/plano");
      break;
    }
    case "customer.subscription.deleted": {
      await db.update(subscriptions).set({ plan: "free", status: "canceled", cancelAtPeriodEnd: false }).where(eq(subscriptions.orgId, orgId));
      break;
    }
    case "customer.subscription.updated": {
      const end = o.current_period_end;
      await db.update(subscriptions).set({ cancelAtPeriodEnd: !!o.cancel_at_period_end, status: o.cancel_at_period_end ? "canceling" : o.status === "past_due" ? "past_due" : "active", ...(end ? { periodEnd: new Date(end * 1000) } : {}) }).where(eq(subscriptions.orgId, orgId));
      break;
    }
  }
  return { ok: true };
}
