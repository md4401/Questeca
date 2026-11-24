import "server-only";
import { db } from "@/db";
import { lessonPlans, type LessonPlanContent } from "@/db/schema";
import { loadClass } from "@/lib/access";
import { templatePlan } from "@/lib/core/lesson-plan";
import { aiAvailable, aiLessonPlan } from "@/lib/ai";
import { gradeLabel, subjectLabel } from "@/lib/taxonomy";
import { todayISO, fmtDate } from "@/lib/format";
import { track } from "@/lib/audit";
import type { Ctx } from "@/lib/session";

/** Cria o plano de aula (IA quando disponível, modelo determinístico como reserva). Usado pelo formulário e pelo assistente. */
export async function criarPlanoDeAula(ctx: Ctx, p: { theme: string; classId?: string | null; durationMin: number; plannedFor?: string | null; subject?: string; grade?: string }): Promise<{ id: string; origem?: string }> {
  let orgId = ctx.org.id; let className = "—"; let subject = p.subject ?? "Matemática"; let grade = p.grade ?? ""; let classId: string | null = null;
  if (p.classId) {
    const { cls } = await loadClass(ctx, p.classId);
    classId = cls.id; orgId = cls.orgId; className = cls.name; subject = subjectLabel(cls.subject); grade = gradeLabel(cls.grade);
  }
  const orgName = ctx.orgs.find((o) => o.id === orgId)?.name ?? ctx.org.name;
  const date = p.plannedFor || todayISO();
  const input = { theme: p.theme, grade, subject, durationMin: p.durationMin, school: orgName, className, teacher: ctx.user.name, date: fmtDate(date) };
  let content: LessonPlanContent = templatePlan(input);
  if (aiAvailable()) {
    try {
      const a = await aiLessonPlan({ theme: input.theme, grade, subject, durationMin: input.durationMin });
      const sum = a.momentos?.reduce((s, m) => s + Number(m.minutos || 0), 0);
      if (a.objetivos?.length && a.momentos?.length === 5 && sum === input.durationMin) content = { ...content, ...a, origem: "ia" };
    } catch { /* cai no modelo */ }
  }
  const [row] = await db.insert(lessonPlans).values({ orgId, classId, authorId: ctx.user.id, theme: p.theme, plannedFor: date, durationMin: p.durationMin, content }).returning();
  await track("lesson_plan_created", ctx.user.id, orgId, { origem: content.origem });
  return { id: row.id, origem: content.origem };
}
