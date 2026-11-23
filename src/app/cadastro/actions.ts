"use server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, orgs, classes, classTeachers } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { parseDraft, stepProblem, flatten, type Draft } from "@/lib/core/onboarding";
import { getSchool } from "@/lib/schools";
import { normalize, SUBJECTS } from "@/lib/taxonomy";
import { audit, track } from "@/lib/audit";
import { can } from "@/lib/core/permissions";

/** Valida o rascunho do cliente: a escola do catálogo vem do banco, nunca do navegador. */
async function sanitize(raw: unknown): Promise<Draft> {
  const d = parseDraft(raw);
  const s = d.school;
  if (s?.kind === "catalog") {
    const row = await getSchool(s.id);
    d.school = row ? { kind: "catalog", id: row.id, name: row.name, city: row.city, uf: row.uf, neighborhood: row.neighborhood } : undefined;
  } else if (s?.kind === "manual") {
    d.school = { kind: "manual", name: String(s.name ?? "").trim().slice(0, 160), city: String(s.city ?? "").trim().slice(0, 80), uf: String(s.uf ?? "").toUpperCase().slice(0, 2) };
  } else if (s?.kind === "linked") {
    d.school = s; // confirmado em finish contra as filiações reais
  } else if (s?.kind !== "none") d.school = undefined;
  const known = new Set(SUBJECTS.map((x) => x.value));
  d.subjects = d.subjects.filter((x) => known.has(x) || (x.startsWith("custom:") && x.length > 8 && x.length <= 60));
  return d;
}

export async function saveDraftAction(raw: unknown): Promise<{ ok: boolean }> {
  const ctx = await requireCtx();
  const d = await sanitize(raw);
  await db.update(users).set({ onboardingDraft: d as unknown as Record<string, unknown> }).where(eq(users.id, ctx.user.id));
  return { ok: true };
}

export async function finishOnboardingAction(raw: unknown): Promise<{ error?: string }> {
  const ctx = await requireCtx();
  const d = await sanitize(raw);
  for (const st of [1, 2, 3] as const) { const p = stepProblem(d, st); if (p) return { error: p }; }
  if (!can(ctx.org.role, "class.create") && ctx.org.role !== "teacher") return { error: "Seu papel não permite criar turmas." };

  // A escola escolhida pela busca é contexto do perfil. Só o espaço pessoal recebe esse contexto;
  // o acesso a uma escola institucional continua dependendo de convite.
  if (ctx.org.kind === "personal" && d.school && d.school.kind !== "linked") {
    if (d.school.kind === "catalog") await db.update(orgs).set({ name: d.school.name, schoolId: d.school.id, city: d.school.city, uf: d.school.uf, schoolManual: false }).where(eq(orgs.id, ctx.org.id));
    else if (d.school.kind === "manual") await db.update(orgs).set({ name: d.school.name, schoolId: null, city: d.school.city, uf: d.school.uf, schoolManual: true }).where(eq(orgs.id, ctx.org.id));
    else await db.update(orgs).set({ name: "Espaço pessoal", schoolId: null, city: null, uf: null, schoolManual: false }).where(eq(orgs.id, ctx.org.id));
  }

  const year = new Date().getFullYear();
  const existing = await db.select().from(classes).where(and(eq(classes.orgId, ctx.org.id), eq(classes.archived, false)));
  const key = (s: string, g: string, n: string) => `${s}|${g}|${normalize(n)}`;
  const have = new Map(existing.map((c) => [key(c.subject, c.grade, c.name), c.id]));
  let first: string | undefined;
  for (const a of flatten(d)) {
    let id = have.get(key(a.subject, a.grade, a.name));
    if (!id) {
      const [c] = await db.insert(classes).values({ orgId: ctx.org.id, name: a.name, grade: a.grade, subject: a.subject, year, createdBy: ctx.user.id }).returning();
      await db.insert(classTeachers).values({ classId: c.id, userId: ctx.user.id });
      id = c.id;
      await track("class_created", ctx.user.id, ctx.org.id);
    } else {
      await db.insert(classTeachers).values({ classId: id, userId: ctx.user.id }).onConflictDoNothing();
    }
    first ??= id;
  }
  await db.update(users).set({ onboardingDraft: { ...d, step: 4 } as unknown as Record<string, unknown>, onboardingDoneAt: new Date() }).where(eq(users.id, ctx.user.id));
  await audit(ctx.user.id, ctx.org.id, "onboarding.done");
  await track("onboarding_done", ctx.user.id, ctx.org.id);
  redirect(`/app?novo=1${first ? `&turma=${first}` : ""}`);
}
