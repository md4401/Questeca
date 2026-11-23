"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { gradeItems, grades, gradeChanges, gradeSubmissions, memberships, orgs } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadApplication, classStudents } from "@/lib/access";
import { applicationData } from "@/lib/correction";
import { saveResponse, setPresence } from "@/app/app/provas/correcao-actions";
import { verifyCard } from "@/lib/core/card-token";
import { env } from "@/lib/env";
import { consumeCard } from "@/lib/billing";
import { rulesFrom } from "@/lib/gradebook";
import { audit, notify, track } from "@/lib/audit";
import type { FormState } from "@/components/form";

/**
 * Cartão com QR: o professor confere as respostas, a nota é calculada pelo gabarito e enviada à escola
 * (lançada na turma + aviso à coordenação). Reenviar atualiza e registra no histórico de alterações de nota.
 */
export async function submitCardGradeAction(token: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const t = verifyCard(token, env.secret());
  if (!t) return { error: "QR inválido ou adulterado." };
  const { app, cls } = await loadApplication(ctx, t.appId);
  const studs = await classStudents(app.classId);
  const stud = studs.find((s) => s.id === t.studentId);
  if (!stud) return { error: "Este aluno não está mais ativo na turma." };

  const absent = fd.get("absent") === "on";
  const data0 = await applicationData(app);
  const [orgRow] = await db.select({ settings: orgs.settings }).from(orgs).where(eq(orgs.id, cls.orgId)).limit(1);
  const rules = rulesFrom(orgRow?.settings ?? {});
  const [existing] = await db.select().from(gradeItems).where(eq(gradeItems.applicationId, app.id)).limit(1);
  const period = existing?.period ?? (String(fd.get("period") ?? "") || rules.periods[0]);
  const maxPoints = Math.round(data0.key.total * 100) / 100;

  let state = "absent"; let value: string | null = null;
  if (absent) {
    await setPresence(app.id, stud.id, true);
  } else {
    const q = await consumeCard(cls.orgId, `${app.id}:${stud.id}`);
    if (!q.ok) return { error: q.reason };
    await setPresence(app.id, stud.id, false);
    for (const it of data0.key.items) {
      const r = await saveResponse(app.id, stud.id, it.position, String(fd.get(`a${it.position}`) ?? ""));
      if ("error" in r && r.error) return { error: `Questão ${it.position}: ${r.error}` };
    }
    const row = (await applicationData(app)).rows.find((r) => r.student.id === stud.id)!;
    if (!row.complete) return { error: "Há questões discursivas sem pontuação. Informe os pontos de todas para enviar a nota." };
    value = String(row.total); state = row.total === 0 ? "zero" : "value";
  }

  const item = existing ?? (await db.insert(gradeItems).values({ classId: cls.id, title: app.title, category: "prova", period, maxPoints: String(maxPoints), applicationId: app.id }).returning())[0];
  const [before] = await db.select().from(grades).where(and(eq(grades.gradeItemId, item.id), eq(grades.studentId, stud.id))).limit(1);
  if (!before || before.state !== state || Number(before.value ?? -1) !== Number(value ?? -1)) {
    await db.insert(grades).values({ gradeItemId: item.id, studentId: stud.id, state, value, source: "cards", updatedBy: ctx.user.id })
      .onConflictDoUpdate({ target: [grades.gradeItemId, grades.studentId], set: { state, value, source: "cards", updatedBy: ctx.user.id, updatedAt: new Date() } });
    await db.insert(gradeChanges).values({ gradeItemId: item.id, studentId: stud.id, before: before ? { state: before.state, value: before.value } : null, after: { state, value }, actorId: ctx.user.id, source: "cards", reason: "Cartão QR" });
  }
  if (absent || value == null) { revalidatePath(`/app/turmas/${cls.id}/notas`); return { ok: `${stud.name}: registrado como ausente na prova.` }; }

  await db.insert(gradeSubmissions).values({ orgId: cls.orgId, classId: cls.id, applicationId: app.id, studentId: stud.id, gradeItemId: item.id, value, maxPoints: String(maxPoints), submittedBy: ctx.user.id })
    .onConflictDoUpdate({ target: [gradeSubmissions.applicationId, gradeSubmissions.studentId], set: { value, maxPoints: String(maxPoints), gradeItemId: item.id, submittedBy: ctx.user.id, submittedAt: new Date() } });
  const coords = await db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.orgId, cls.orgId), eq(memberships.role, "coordinator"), eq(memberships.status, "active")));
  for (const c of coords.filter((c) => c.userId !== ctx.user.id)) await notify(c.userId, "nota", "Notas recebidas", `Notas de ${app.title} (${cls.name}) enviadas pelo professor.`, "/app", { groupKey: `qr:${app.id}` });
  await audit(ctx.user.id, cls.orgId, "grades.qr_submitted", app.id, { studentId: stud.id, value, max: maxPoints });
  await track("grade_qr_submitted", ctx.user.id, cls.orgId);
  revalidatePath(`/app/turmas/${cls.id}/notas`); revalidatePath("/app");
  return { ok: `Nota enviada à escola: ${stud.name} — ${String(Number(value)).replace(".", ",")} de ${String(maxPoints).replace(".", ",")}.` };
}
