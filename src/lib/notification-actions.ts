"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { requireAnyCtx } from "@/lib/session";
import { NOTIFY_LABEL, type NotifyCategory } from "@/lib/audit";
import type { FormState } from "@/components/form";

export async function markNotificationAction(id: string) {
  const ctx = await requireAnyCtx();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, ctx.user.id)));
  revalidatePath("/app", "layout");
}
export async function markAllNotificationsAction() {
  const ctx = await requireAnyCtx();
  await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, ctx.user.id));
  revalidatePath("/app", "layout");
}
/** Preferências por categoria. Segurança e pagamento não podem ser silenciados. */
export async function saveNotificationPrefsAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireAnyCtx();
  const cats = Object.keys(NOTIFY_LABEL) as NotifyCategory[];
  const mute = cats.filter((c) => c !== "seguranca" && c !== "pagamento" && fd.get(`c_${c}`) !== "on");
  await db.update(users).set({ prefs: { ...(ctx.user.prefs ?? {}), mute } }).where(eq(users.id, ctx.user.id));
  revalidatePath("/app", "layout");
  return { ok: "Preferências salvas." };
}
