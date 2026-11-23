"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, riskAlerts } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { loadRadar } from "@/lib/radar";
import { audit, notify } from "@/lib/audit";
import type { FormState } from "@/components/form";

/** Avisa a coordenação da escola da turma. O motivo vem do cálculo do servidor (não do formulário). Notificação genérica, sem nota/falta no texto. */
export async function alertCoordinationAction(classId: string, studentId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  if (!(await classStudents(classId)).some((s) => s.id === studentId)) return { error: "Aluno não pertence à turma." };
  const row = (await loadRadar(ctx)).find((r) => r.classId === classId && r.studentId === studentId);
  if (!row) return { error: "Este aluno não está mais no radar." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || null;
  const coords = await db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.orgId, cls.orgId), eq(memberships.role, "coordinator"), eq(memberships.status, "active")));
  const targets = coords.filter((c) => c.userId !== ctx.user.id);
  for (const c of targets) await notify(c.userId, "frequencia", "Aluno em atenção", `Turma ${cls.name}: um aluno foi sinalizado pelo professor. Abra o radar para ver.`, `/app/radar`, { groupKey: `radar:${cls.id}`, priority: "high" });
  await db.insert(riskAlerts).values({ orgId: cls.orgId, classId, studentId, reasons: row.result.reasons, note, sentBy: ctx.user.id, notified: targets.length });
  await audit(ctx.user.id, cls.orgId, "risk.alerted", studentId, { classId, reasons: row.result.reasons, notified: targets.length });
  revalidatePath("/app/radar"); revalidatePath("/app");
  return { ok: targets.length ? `Coordenação avisada (${targets.length} pessoa(s)).` : "Alerta registrado. Esta escola não tem coordenador cadastrado para receber o aviso." };
}
