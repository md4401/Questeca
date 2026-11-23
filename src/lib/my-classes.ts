import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, classTeachers, orgs } from "@/db/schema";
import type { Ctx } from "@/lib/session";

/** Turmas do usuário em TODAS as suas escolas (professor em 2–3 escolas). Coordenação vê todas as turmas da escola; professor, as suas. */
export async function myClassesAllOrgs(ctx: Ctx) {
  const rows = await db.select({ c: classes, orgName: orgs.name }).from(classes).innerJoin(orgs, eq(orgs.id, classes.orgId))
    .where(and(inArray(classes.orgId, ctx.orgs.map((o) => o.id)), eq(classes.archived, false)));
  const mine = new Set((await db.select({ classId: classTeachers.classId }).from(classTeachers).where(eq(classTeachers.userId, ctx.user.id))).map((m) => m.classId));
  const role = new Map(ctx.orgs.map((o) => [o.id, o.role]));
  return rows.filter(({ c }) => { const r = role.get(c.orgId); return r === "coordinator" || (r !== "admin" && mine.has(c.id)); }).map(({ c, orgName }) => ({ ...c, orgName }));
}
