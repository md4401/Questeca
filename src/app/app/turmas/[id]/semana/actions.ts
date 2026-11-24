"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { classWeeks } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { semanaDe, lerLinks } from "@/lib/core/semana";
import { todayISO } from "@/lib/format";
import type { FormState } from "@/components/form";

/** Salva a "matéria da semana" da turma. O link público é fixo por turma (mesmo token em todas as semanas). */
export async function salvarSemanaAction(classId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx(); await loadClass(ctx, classId);
  const content = String(fd.get("content") ?? "").trim().slice(0, 4000);
  const homework = String(fd.get("homework") ?? "").trim().slice(0, 2000);
  const links = lerLinks(String(fd.get("links") ?? ""));
  const published = fd.get("published") === "on";
  const weekOf = semanaDe(todayISO());
  const [prev] = await db.select({ token: classWeeks.token }).from(classWeeks).where(eq(classWeeks.classId, classId)).orderBy(desc(classWeeks.weekOf)).limit(1);
  const token = prev?.token ?? randomBytes(9).toString("base64url");
  await db.insert(classWeeks).values({ classId, authorId: ctx.user.id, token, weekOf, content, homework, links, published })
    .onConflictDoUpdate({ target: [classWeeks.classId, classWeeks.weekOf], set: { content, homework, links, published, updatedAt: new Date() } });
  revalidatePath(`/app/turmas/${classId}/semana`); revalidatePath(`/s/${token}`);
  return { ok: published ? "Publicado. Compartilhe o link com a turma." : "Salvo (oculto: o link não mostra esta semana)." };
}
