"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendanceSessions, attendanceRecords, attendanceChanges } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { validStatus } from "@/lib/core/attendance";
import { todayISO } from "@/lib/format";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/form";

/**
 * Registra a chamada de uma data/aula. Uma chamada por turma, data e aula (sem duplicar).
 * Repetir o envio é uma correção: exige motivo e fica no histórico. Quem não foi marcado não vira falta.
 */
export async function saveAttendanceAction(classId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const date = String(fd.get("date") ?? ""); const lesson = String(fd.get("lesson") ?? "").trim().slice(0, 40);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Informe a data da aula." };
  if (date > todayISO()) return { error: "Não é possível registrar chamada de uma data futura." };
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 300);
  const roster = await classStudents(classId);
  const incoming = new Map<string, { status: string; note: string }>();
  for (const s of roster) {
    const st = String(fd.get(`st_${s.id}`) ?? "");
    if (!st) continue; // sem marcação: não conta como falta
    if (!validStatus(st)) return { error: "Situação de presença inválida." };
    incoming.set(s.id, { status: st, note: String(fd.get(`note_${s.id}`) ?? "").trim().slice(0, 200) });
  }
  if (incoming.size === 0) return { error: "Marque a presença de ao menos um aluno." };

  let [sess] = await db.select().from(attendanceSessions).where(and(eq(attendanceSessions.classId, classId), eq(attendanceSessions.date, date), eq(attendanceSessions.lesson, lesson))).limit(1);
  
  if (!sess) {
    [sess] = await db.insert(attendanceSessions).values({ orgId: cls.orgId, classId, subject: cls.subject, date, lesson, takenBy: ctx.user.id }).onConflictDoNothing().returning();
    if (!sess) return { error: "Esta chamada acabou de ser registrada por outra pessoa. Recarregue a página." };
    await db.insert(attendanceRecords).values([...incoming].map(([studentId, v]) => ({ sessionId: sess.id, studentId, status: v.status, note: v.note || null, updatedBy: ctx.user.id })));
  } else {
    const before = new Map((await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, sess.id))).map((r) => [r.studentId, r]));
    const diffs = [...incoming].filter(([sid, v]) => before.get(sid)?.status !== v.status || (before.get(sid)?.note ?? "") !== (v.note || ""));
    if (diffs.length === 0) return { ok: "Nenhuma alteração." };
    if (reason.length < 3) return { error: "Esta chamada já foi registrada. Para corrigir, informe o motivo da correção." };
    for (const [sid, v] of diffs) {
      const b = before.get(sid);
      await db.insert(attendanceRecords).values({ sessionId: sess.id, studentId: sid, status: v.status, note: v.note || null, updatedBy: ctx.user.id })
        .onConflictDoUpdate({ target: [attendanceRecords.sessionId, attendanceRecords.studentId], set: { status: v.status, note: v.note || null, updatedBy: ctx.user.id, updatedAt: new Date() } });
      if (b?.status !== v.status) await db.insert(attendanceChanges).values({ sessionId: sess.id, studentId: sid, before: b?.status ?? null, after: v.status, reason, changedBy: ctx.user.id });
    }
    await audit(ctx.user.id, cls.orgId, "attendance.corrected", sess.id, { reason, count: diffs.length });
  }
  revalidatePath(`/app/turmas/${classId}/frequencia`);
  return { ok: sess ? "Chamada salva." : "Chamada salva." };
}
