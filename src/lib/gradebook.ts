import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { gradeItems, grades, periodCloses, type OrgSettings } from "@/db/schema";
import { classStudents } from "@/lib/access";
import { computeAverage, DEFAULT_RULES, type GradeCell, type GradeItemMeta, type Rules } from "@/lib/core/grades";

export const DEFAULT_PERIODS = ["1º bimestre", "2º bimestre", "3º bimestre", "4º bimestre"];

export function rulesFrom(settings: OrgSettings): Rules & { periods: string[] } {
  const g = settings.grading;
  return {
    scaleMax: g?.scaleMax ?? DEFAULT_RULES.scaleMax,
    passMark: g?.passMark ?? DEFAULT_RULES.passMark,
    rounding: g?.rounding ?? DEFAULT_RULES.rounding,
    absenceCounts: g?.absenceCounts ?? DEFAULT_RULES.absenceCounts,
    notDeliveredCounts: g?.notDeliveredCounts ?? DEFAULT_RULES.notDeliveredCounts,
    recovery: g?.recovery ?? DEFAULT_RULES.recovery,
    periods: g?.periods?.length ? g.periods : DEFAULT_PERIODS,
  };
}

export async function loadGradebook(classId: string, period: string, rules: Rules) {
  const [students, items, closed] = await Promise.all([
    classStudents(classId),
    db.select().from(gradeItems).where(and(eq(gradeItems.classId, classId), eq(gradeItems.period, period))).orderBy(gradeItems.createdAt),
    db.select().from(periodCloses).where(and(eq(periodCloses.classId, classId), eq(periodCloses.period, period))).limit(1),
  ]);
  const itemIds = items.map((i) => i.id);
  const cells = itemIds.length ? await db.select().from(grades).where(inArray(grades.gradeItemId, itemIds)) : [];
  const key = (itemId: string, studentId: string) => `${itemId}:${studentId}`;
  const map = new Map(cells.map((c) => [key(c.gradeItemId, c.studentId), c]));
  const metas: GradeItemMeta[] = items.map((i) => ({ id: i.id, title: i.title, weight: Number(i.weight), maxPoints: Number(i.maxPoints), period: i.period, recovery: i.recovery }));
  const isClosed = !!closed[0] && !closed[0].reopenedAt;

  const rows = students.map((s) => {
    const sc: GradeCell[] = items.map((i) => {
      const c = map.get(key(i.id, s.id));
      return { itemId: i.id, state: (c?.state ?? "pending") as GradeCell["state"], value: c?.value != null ? Number(c.value) : null };
    });
    return { student: s, cells: sc, computed: computeAverage(sc, metas, rules) };
  });
  return { students, items, metas, rows, closed: isClosed };
}

export function cellLabel(c: { state: string; value: number | null }) {
  if (c.state === "value" && c.value != null) return String(c.value).replace(".", ",");
  if (c.state === "zero") return "0";
  if (c.state === "absent") return "F";
  if (c.state === "not_delivered") return "N";
  return "";
}

/** Notas de UM estudante (portal): mesma regra de média e fórmula visível do caderno, sem carregar os colegas. */
export async function studentGrades(classId: string, studentId: string, period: string, rules: Rules) {
  const items = await db.select().from(gradeItems).where(and(eq(gradeItems.classId, classId), eq(gradeItems.period, period))).orderBy(gradeItems.createdAt);
  const ids = items.map((i) => i.id);
  const cells = ids.length ? await db.select().from(grades).where(and(inArray(grades.gradeItemId, ids), eq(grades.studentId, studentId))) : [];
  const metas: GradeItemMeta[] = items.map((i) => ({ id: i.id, title: i.title, weight: Number(i.weight), maxPoints: Number(i.maxPoints), period: i.period, recovery: i.recovery }));
  const sc: GradeCell[] = items.map((i) => { const c = cells.find((x) => x.gradeItemId === i.id); return { itemId: i.id, state: (c?.state ?? "pending") as GradeCell["state"], value: c?.value != null ? Number(c.value) : null }; });
  return { items, cells: sc, computed: computeAverage(sc, metas, rules) };
}
