import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { getCtx } from "@/lib/session";
import { can } from "@/lib/core/permissions";
import { db } from "@/db";
import { classes, students, enrollments, gradeItems, grades, memberships, users, assessments, applications } from "@/db/schema";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** Exportação de dados da escola para a gestão institucional (saída/renovação, PRD cap. 23). */
export async function GET() {
  const ctx = await getCtx();
  if (!ctx || ctx.org.kind !== "school" || !can(ctx.org.role, "org.manage")) return new NextResponse("Não autorizado", { status: 403 });
  const orgId = ctx.org.id;
  const cls = await db.select().from(classes).where(eq(classes.orgId, orgId));
  const ids = cls.map((c) => c.id);
  const [studs, enr, items, mem, asm, apps] = await Promise.all([
    db.select().from(students).where(eq(students.orgId, orgId)),
    ids.length ? db.select().from(enrollments).where(inArray(enrollments.classId, ids)) : [],
    ids.length ? db.select().from(gradeItems).where(inArray(gradeItems.classId, ids)) : [],
    db.select({ name: users.name, email: users.email, role: memberships.role, status: memberships.status }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.orgId, orgId)),
    db.select().from(assessments).where(eq(assessments.orgId, orgId)),
    db.select().from(applications).where(eq(applications.orgId, orgId)),
  ]);
  const gr = items.length ? await db.select().from(grades).where(inArray(grades.gradeItemId, items.map((i) => i.id))) : [];
  await audit(ctx.user.id, orgId, "org.exported");
  void and;
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), school: ctx.org.name, members: mem, classes: cls, students: studs, enrollments: enr, gradeItems: items, grades: gr, assessments: asm.map((a) => ({ id: a.id, title: a.title, status: a.status, classId: a.classId })), applications: apps.map((a) => ({ id: a.id, title: a.title, classId: a.classId, appliedOn: a.appliedOn, kind: a.kind })) }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="escola-export.json"', "Cache-Control": "private, no-store" },
  });
}
