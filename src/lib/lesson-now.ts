import "server-only";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, attendanceSessions, lessonPlans, timetableSlots } from "@/db/schema";
import { lessonNow } from "@/lib/core/lesson-now";
import { classStudents } from "@/lib/access";
import type { Ctx } from "@/lib/session";
import { myClassesAllOrgs } from "@/lib/my-classes";

/** Aula em andamento (ou próxima) do professor em qualquer uma de suas escolas, com plano e chamada. */
export async function loadLessonNow(ctx: Ctx, now = new Date()) {
  const cls = await myClassesAllOrgs(ctx);
  if (!cls.length) return null;
  const ids = cls.map((c) => c.id);
  const slots = await db.select().from(timetableSlots).where(and(inArray(timetableSlots.classId, ids), or(eq(timetableSlots.teacherId, ctx.user.id), isNull(timetableSlots.teacherId))));
  const ln = lessonNow(slots, now);
  const byId = new Map(cls.map((c) => [c.id, c]));
  const decorate = (s: (typeof slots)[number]) => ({ slot: s, cls: byId.get(s.classId)! });
  const agenda = ln.today.map(decorate);
  const focus = ln.current ?? ln.next;
  if (!focus) return { ...ln, agenda, current: null, focus: null };
  const f = decorate(focus);
  const [plan] = await db.select().from(lessonPlans).where(and(eq(lessonPlans.classId, f.cls.id), eq(lessonPlans.plannedFor, ln.dateISO))).orderBy(desc(lessonPlans.updatedAt)).limit(1);
  const fallback = plan ? null : (await db.select().from(lessonPlans).where(eq(lessonPlans.classId, f.cls.id)).orderBy(desc(lessonPlans.updatedAt)).limit(1))[0] ?? null;
  const roster = await classStudents(f.cls.id);
  const [sess] = await db.select().from(attendanceSessions).where(and(eq(attendanceSessions.classId, f.cls.id), eq(attendanceSessions.date, ln.dateISO), eq(attendanceSessions.lesson, focus.startTime))).limit(1);
  const recs = sess ? await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, sess.id)) : [];
  return { ...ln, agenda, current: ln.current ? f : null, focus: f, isCurrent: !!ln.current, plan: plan ?? null, fallbackPlan: fallback, roster, taken: !!sess, absent: new Set(recs.filter((r) => r.status !== "present").map((r) => r.studentId)) };
}
