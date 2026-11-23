"use server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireAnyCtx } from "@/lib/session";

export async function portalDeletionAction(): Promise<void> {
  const ctx = await requireAnyCtx();
  await db.insert(tickets).values({ userId: ctx.user.id, orgId: ctx.org.id, subject: "Privacidade: solicitação de exclusão/exportação (portal)", body: "Pedido feito pelo portal de aluno/responsável (LGPD)." });
  redirect("/portal/conta");
}
