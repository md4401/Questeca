"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { lessonPlans, memberships, type LessonPlanContent } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { templatePlan } from "@/lib/core/lesson-plan";
import { aiAvailable, aiLessonPlan } from "@/lib/ai";
import { gradeLabel, subjectLabel } from "@/lib/taxonomy";
import { todayISO, fmtDate } from "@/lib/format";
import { audit, notify, track } from "@/lib/audit";
import type { FormState } from "@/components/form";

export async function loadPlan(ctx: Awaited<ReturnType<typeof requireCtx>>, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [p] = await db.select().from(lessonPlans).where(eq(lessonPlans.id, id)).limit(1);
  if (!p) return null;
  const mem = ctx.orgs.find((o) => o.id === p.orgId);
  if (!mem) return null;
  // autor sempre vê; coordenação só vê planos enviados a ela
  if (p.authorId !== ctx.user.id && !(mem.role === "coordinator" && p.sentAt)) return null;
  return p;
}

export async function createPlanAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const p = z.object({ theme: z.string().trim().min(3, "Digite o tema da aula.").max(300), classId: z.string().optional(), durationMin: z.coerce.number().int().min(20).max(240).default(50), plannedFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  let orgId = ctx.org.id; let className = "—"; let subject = "Matemática"; let grade = ""; let classId: string | null = null;
  if (p.data.classId) {
    const { cls } = await loadClass(ctx, p.data.classId);
    classId = cls.id; orgId = cls.orgId; className = cls.name; subject = subjectLabel(cls.subject); grade = gradeLabel(cls.grade);
  }
  const orgName = ctx.orgs.find((o) => o.id === orgId)?.name ?? ctx.org.name;
  const date = p.data.plannedFor || todayISO();
  const input = { theme: p.data.theme, grade, subject, durationMin: p.data.durationMin, school: orgName, className, teacher: ctx.user.name, date: fmtDate(date) };
  let content: LessonPlanContent = templatePlan(input);
  if (aiAvailable()) {
    try {
      const a = await aiLessonPlan({ theme: input.theme, grade, subject, durationMin: input.durationMin });
      const sum = a.momentos?.reduce((s, m) => s + Number(m.minutos || 0), 0);
      if (a.objetivos?.length && a.momentos?.length === 5 && sum === input.durationMin) content = { ...content, ...a, origem: "ia" };
    } catch { /* cai no modelo */ }
  }
  const [row] = await db.insert(lessonPlans).values({ orgId, classId, authorId: ctx.user.id, theme: p.data.theme, plannedFor: date, durationMin: p.data.durationMin, content }).returning();
  await track("lesson_plan_created", ctx.user.id, orgId, { origem: content.origem });
  redirect(`/app/planos-de-aula/${row.id}`);
}

const lines = (s: FormDataEntryValue | null) => String(s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

export async function updatePlanAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const plan = await loadPlan(ctx, id);
  if (!plan || plan.authorId !== ctx.user.id) return { error: "Plano não encontrado." };
  const c = plan.content;
  const momentos = lines(fd.get("momentos")).map((l) => { const [t, m, ...d] = l.split("|").map((x) => x.trim()); return { titulo: t, minutos: Number(m), descricao: d.join(" | ") }; });
  if (momentos.some((m) => !m.titulo || !Number.isFinite(m.minutos) || m.minutos <= 0)) return { error: "Cada momento deve ser: Título | minutos | descrição." };
  const next: LessonPlanContent = { ...c, tema: String(fd.get("tema") ?? c.tema).trim() || c.tema, objetivos: lines(fd.get("objetivos")), habilidades: lines(fd.get("habilidades")), recursos: lines(fd.get("recursos")), momentos, avaliacao: String(fd.get("avaliacao") ?? "").trim(), adaptacoes: String(fd.get("adaptacoes") ?? "").trim(), referencias: lines(fd.get("referencias")) };
  await db.update(lessonPlans).set({ content: next, theme: next.tema, updatedAt: new Date() }).where(eq(lessonPlans.id, id));
  revalidatePath(`/app/planos-de-aula/${id}`);
  return { ok: "Plano salvo." };
}

export async function sendPlanAction(id: string) {
  const ctx = await requireCtx();
  const plan = await loadPlan(ctx, id);
  if (!plan || plan.authorId !== ctx.user.id) return;
  const coords = await db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.orgId, plan.orgId), eq(memberships.role, "coordinator"), eq(memberships.status, "active")));
  await db.update(lessonPlans).set({ sentAt: new Date() }).where(eq(lessonPlans.id, id));
  for (const c of coords.filter((c) => c.userId !== ctx.user.id)) await notify(c.userId, "sistema", "Plano de aula recebido", `${ctx.user.name} enviou o plano “${plan.theme}”.`, `/app/planos-de-aula/${id}`, { groupKey: `plano:${plan.orgId}` });
  await audit(ctx.user.id, plan.orgId, "lesson_plan.sent", id, { coordinators: coords.length });
  revalidatePath(`/app/planos-de-aula/${id}`);
}

export async function deletePlanAction(id: string) {
  const ctx = await requireCtx();
  const plan = await loadPlan(ctx, id);
  if (!plan || plan.authorId !== ctx.user.id) return;
  await db.delete(lessonPlans).where(eq(lessonPlans.id, id));
  redirect("/app/planos-de-aula");
}
