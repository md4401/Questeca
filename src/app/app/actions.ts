"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAnyCtx, setActiveOrg } from "@/lib/session";

export async function switchOrgAction(fd: FormData) {
  const ctx = await requireAnyCtx();
  const id = String(fd.get("orgId") ?? "");
  if (ctx.orgs.some((o) => o.id === id)) await setActiveOrg(ctx.sessionId, id);
  redirect("/app");
}

/** Marca o tour de uma página como visto (por usuário). */
export async function tourVistoAction(id: string) {
  const ctx = await requireAnyCtx();
  if (!/^[a-z0-9-]{2,30}$/.test(id)) return;
  const atual = ctx.user.prefs.tours ?? [];
  if (atual.includes(id)) return;
  await db.update(users).set({ prefs: { ...ctx.user.prefs, tours: [...atual, id] } }).where(eq(users.id, ctx.user.id));
}
export async function refazerToursAction() {
  const ctx = await requireAnyCtx();
  await db.update(users).set({ prefs: { ...ctx.user.prefs, tours: [] } }).where(eq(users.id, ctx.user.id));
}
