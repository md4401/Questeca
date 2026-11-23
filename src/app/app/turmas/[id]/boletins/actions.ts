"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { reportCards } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { buildReportCard } from "@/lib/report-card";
import { rulesFrom } from "@/lib/gradebook";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/form";

/** Gera e guarda o PDF do boletim (o arquivo emitido fica preservado como foi gerado). */
export async function generateReportCardAction(classId: string, studentId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const period = String(fd.get("period") ?? "");
  if (!rulesFrom(ctx.org.settings).periods.includes(period)) return { error: "Escolha o período." };
  if (!(await classStudents(cls.id)).some((s) => s.id === studentId)) return { error: "Aluno não pertence a esta turma." };
  const pdf = await buildReportCard({ orgName: ctx.org.name, settings: ctx.org.settings, studentId, period });
  await db.insert(reportCards).values({ orgId: cls.orgId, studentId, period, pdf: Buffer.from(pdf), generatedBy: ctx.user.id });
  await audit(ctx.user.id, cls.orgId, "reportcard.generated", studentId, { period });
  revalidatePath(`/app/turmas/${classId}/boletins`);
  return { ok: "Boletim gerado. Abra o PDF na lista abaixo do aluno." };
}
