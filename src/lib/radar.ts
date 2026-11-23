import "server-only";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, attendanceSessions, enrollments, gradeItems, grades, riskAlerts, students, orgs } from "@/db/schema";
import { radarOf, radarThresholdsFrom, type RadarResult } from "@/lib/core/radar";
import { rulesFrom } from "@/lib/gradebook";
import type { Ctx } from "@/lib/session";
import { myClassesAllOrgs } from "@/lib/my-classes";

export type RadarRow = { classId: string; className: string; orgId: string; orgName: string; studentId: string; studentName: string; result: RadarResult; alertedAt: Date | null };

/** Varre as turmas do professor (em todas as escolas) e devolve só quem merece atenção, do mais grave ao menos grave. */
export async function loadRadar(ctx: Ctx): Promise<RadarRow[]> {
  const cls = await myClassesAllOrgs(ctx);
  if (!cls.length) return [];
  const ids = cls.map((c) => c.id);
  const orgRows = await db.select({ id: orgs.id, settings: orgs.settings }).from(orgs).where(inArray(orgs.id, [...new Set(cls.map((c) => c.orgId))]));
  const settingsOf = new Map(orgRows.map((o) => [o.id, o.settings]));
  const [roster, items, sessions] = await Promise.all([
    db.select({ classId: enrollments.classId, id: students.id, name: students.name }).from(enrollments).innerJoin(students, eq(students.id, enrollments.studentId)).where(and(inArray(enrollments.classId, ids), eq(enrollments.status, "active"))),
    db.select().from(gradeItems).where(inArray(gradeItems.classId, ids)),
    db.select().from(attendanceSessions).where(inArray(attendanceSessions.classId, ids)),
  ]);
  const itemIds = items.map((i) => i.id); const sessIds = sessions.map((s) => s.id);
  const [gr, recs, alerts] = await Promise.all([
    itemIds.length ? db.select().from(grades).where(inArray(grades.gradeItemId, itemIds)) : Promise.resolve([]),
    sessIds.length ? db.select().from(attendanceRecords).where(inArray(attendanceRecords.sessionId, sessIds)) : Promise.resolve([]),
    db.select().from(riskAlerts).where(and(inArray(riskAlerts.classId, ids), gte(riskAlerts.createdAt, new Date(Date.now() - 14 * 864e5)))),
  ]);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const sessById = new Map(sessions.map((s) => [s.id, s]));
  const out: RadarRow[] = [];
  for (const c of cls) {
    const settings = settingsOf.get(c.orgId) ?? {};
    const t = radarThresholdsFrom(settings.risk, rulesFrom(settings).passMark);
    const classItems = items.filter((i) => i.classId === c.id).sort((a, b) => +a.createdAt - +b.createdAt);
    const classSess = sessions.filter((s) => s.classId === c.id).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : +a.createdAt - +b.createdAt));
    for (const st of roster.filter((r) => r.classId === c.id)) {
      const scores = classItems.flatMap((it) => {
        const g = gr.find((x) => x.gradeItemId === it.id && x.studentId === st.id);
        if (!g || (g.state !== "value" && g.state !== "zero") || g.value == null) return [];
        const max = Number(itemById.get(it.id)!.maxPoints) || 10;
        return [(Number(g.value) / max) * 10];
      });
      const att = classSess.flatMap((s) => { const r = recs.find((x) => x.sessionId === s.id && x.studentId === st.id); return r ? [r.status] : []; });
      const result = radarOf({ scores, attendance: att }, t);
      if (result.level === "ok") continue;
      const al = alerts.filter((a) => a.studentId === st.id && a.classId === c.id).sort((a, b) => +b.createdAt - +a.createdAt)[0];
      out.push({ classId: c.id, className: c.name, orgId: c.orgId, orgName: c.orgName, studentId: st.id, studentName: st.name, result, alertedAt: al?.createdAt ?? null });
    }
  }
  void sessById;
  return out.sort((a, b) => (a.result.level === b.result.level ? b.result.reasons.length - a.result.reasons.length : a.result.level === "alerta" ? -1 : 1));
}
