"use server";
import { db } from "@/db";
import { questionFlags } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";

export async function flagQuestionAction(questionId: string, fd: FormData): Promise<{ ok?: string; error?: string }> {
  const ctx = await requireCtx();
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) return { error: "Questão inválida." };
  if (!(await rateLimit(`flag:${ctx.user.id}`, 20, 3600))) return { error: "Muitas denúncias em pouco tempo." };
  const reason = String(fd.get("reason") ?? "outro");
  await db.insert(questionFlags).values({ questionId, reporterId: ctx.user.id, reason, detail: String(fd.get("detail") ?? "").slice(0, 1000) });
  return { ok: "Obrigado! A curadoria vai analisar." };
}
