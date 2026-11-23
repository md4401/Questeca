"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { demoRequests, classes } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { can } from "@/lib/core/permissions";
import { startCheckout, cancelAtPeriodEnd, reactivate } from "@/lib/billing-provider";
import { audit } from "@/lib/audit";

async function authorizedBilling() {
  const ctx = await requireCtx();
  if (ctx.org.kind === "school" && !can(ctx.org.role, "org.billing")) redirect("/app/plano?erro=" + encodeURIComponent("Só o responsável autorizado administra a cobrança da escola."));
  return ctx;
}

export async function checkoutAction() {
  const ctx = await authorizedBilling();
  if (ctx.org.kind === "school") redirect("/app/plano?erro=" + encodeURIComponent("Escolas contratam por proposta."));
  const r = await startCheckout(ctx.org.id, ctx.user.email);
  if ("error" in r) redirect("/app/plano?erro=" + encodeURIComponent(r.error));
  await audit(ctx.user.id, ctx.org.id, "billing.checkout");
  redirect("url" in r ? r.url : "/app/plano?ok=1");
}

export async function cancelAction() {
  const ctx = await authorizedBilling();
  await cancelAtPeriodEnd(ctx.org.id);
  await audit(ctx.user.id, ctx.org.id, "billing.cancel");
  revalidatePath("/app/plano");
}

export async function reactivateAction() {
  const ctx = await authorizedBilling();
  await reactivate(ctx.org.id);
  await audit(ctx.user.id, ctx.org.id, "billing.reactivate");
  revalidatePath("/app/plano");
}

export async function requestContractAction() {
  const ctx = await requireCtx();
  await db.insert(demoRequests).values({ name: ctx.user.name, email: ctx.user.email, school: ctx.org.name, message: "Solicitação de contratação pelo app." });
  redirect("/app/plano?ok=" + encodeURIComponent("Solicitação registrada. Entraremos em contato por e-mail."));
}

export async function archiveForLimitAction(classId: string) {
  await requireCtx();
  await db.update(classes).set({ archived: true }).where(eq(classes.id, classId));
  revalidatePath("/app/plano");
}
