"use server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { digitalLinks } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadApplication, classStudents } from "@/lib/access";
import { randomToken } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/form";

/** Gera um link individual por aluno (sem listar a turma publicamente). Reexecutar só cria os que faltam. */
export async function generateLinksAction(appId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { app } = await loadApplication(ctx, appId);
  if (app.kind === "external" || !app.versionId) return { error: "A aplicação digital exige uma prova da Questeca." };
  const hours = Math.min(168, Math.max(1, Number(fd.get("hours") ?? 24)));
  const studs = await classStudents(app.classId);
  if (!studs.length) return { error: "Cadastre os alunos da turma para gerar os links." };
  const existing = await db.select().from(digitalLinks).where(eq(digitalLinks.applicationId, appId));
  const have = new Set(existing.map((e) => e.studentId));
  const expiresAt = new Date(Date.now() + hours * 3600e3);
  const fresh = studs.filter((s) => !have.has(s.id)).map((s) => ({ applicationId: appId, studentId: s.id, token: randomToken(24), expiresAt }));
  if (fresh.length) await db.insert(digitalLinks).values(fresh);
  // prorroga os ainda não enviados
  await db.update(digitalLinks).set({ expiresAt }).where(and(eq(digitalLinks.applicationId, appId)));
  await audit(ctx.user.id, ctx.org.id, "digital.links_generated", appId, { created: fresh.length, hours });
  revalidatePath(`/app/provas/${app.assessmentId}/correcao`);
  return { ok: `${fresh.length} link(s) criado(s); validade renovada para ${hours} h. Envie cada link pelo canal oficial da escola.` };
}

export async function revokeLinksAction(appId: string) {
  const ctx = await requireCtx();
  const { app } = await loadApplication(ctx, appId);
  await db.update(digitalLinks).set({ expiresAt: new Date(0) }).where(eq(digitalLinks.applicationId, appId));
  await audit(ctx.user.id, ctx.org.id, "digital.links_revoked", appId);
  revalidatePath(`/app/provas/${app.assessmentId}/correcao`);
}
