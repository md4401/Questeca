"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  users, classes, classTeachers, students, enrollments, observations, lessonLogs, gradeItems, grades, gradeChanges, periodCloses,
} from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { canCreateClass } from "@/lib/billing";
import { can } from "@/lib/core/permissions";
import { parseGradeInput } from "@/lib/core/grades";
import { normalize } from "@/lib/taxonomy";
import { audit, track } from "@/lib/audit";
import { todayISO } from "@/lib/format";
import { rulesFrom, loadGradebook } from "@/lib/gradebook";
import type { FormState } from "@/components/form";

const GRADE_VALUES = ["6", "7", "8", "9", "em1", "em2", "em3"];

export async function createClassAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const p = z.object({
    name: z.string().trim().min(1, "Informe a identificação da turma, por exemplo 9º B.").max(60),
    grade: z.enum(GRADE_VALUES as [string, ...string[]], { error: "Escolha o ano/série." }),
    subject: z.string().default("matematica"),
    year: z.coerce.number().int().min(2020).max(2100).default(new Date().getFullYear()),
    next: z.string().optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (!can(ctx.org.role, "class.create")) return { error: "Seu papel não permite criar turmas." };
  const lim = await canCreateClass(ctx.org.id);
  if (!lim.ok) return { error: lim.reason };
  const [c] = await db.insert(classes).values({ orgId: ctx.org.id, name: p.data.name, grade: p.data.grade, subject: p.data.subject, year: p.data.year, createdBy: ctx.user.id }).returning();
  await db.insert(classTeachers).values({ classId: c.id, userId: ctx.user.id });
  await audit(ctx.user.id, ctx.org.id, "class.created", c.id);
  await track("class_created", ctx.user.id, ctx.org.id);
  redirect(p.data.next === "prova" ? `/app/provas/nova?turma=${c.id}` : `/app/turmas/${c.id}`);
}

const DEMO_NAMES = ["Ana Exemplo", "Bruno Exemplo", "Carla Exemplo", "Diego Exemplo", "Elisa Exemplo", "Fábio Exemplo", "Gabriela Exemplo", "Hugo Exemplo"];

/** Turma de exemplo identificada, para quem só quer avaliar a ferramenta. Não consome o limite de turmas. */
export async function createDemoClassAction() {
  const ctx = await requireCtx();
  const [c] = await db.insert(classes).values({ orgId: ctx.org.id, name: "9º B (turma de exemplo)", grade: "9", subject: "matematica", year: new Date().getFullYear(), isDemo: true, createdBy: ctx.user.id }).returning();
  await db.insert(classTeachers).values({ classId: c.id, userId: ctx.user.id });
  const st = await db.insert(students).values(DEMO_NAMES.map((n, i) => ({ orgId: ctx.org.id, name: n, registration: `EX${String(i + 1).padStart(3, "0")}` }))).returning();
  await db.insert(enrollments).values(st.map((s) => ({ classId: c.id, studentId: s.id })));
  await db.update(users).set({ onboardingDoneAt: new Date() }).where(eq(users.id, ctx.user.id));
  redirect(`/app/provas/nova?turma=${c.id}`);
}

export async function archiveClassAction(classId: string) {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  await db.update(classes).set({ archived: true }).where(eq(classes.id, cls.id));
  await audit(ctx.user.id, ctx.org.id, "class.archived", cls.id);
  redirect("/app/turmas");
}

/* ---------- Alunos ---------- */
export type StudentRow = { line: number; name: string; registration: string | null; status: "novo" | "repetido" | "homonimo" | "erro"; message?: string; include: boolean };

function parseStudentLines(text: string) {
  const rows: { line: number; name: string; registration: string | null }[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const l = raw.trim();
    if (!l) return;
    const parts = l.split(/[;\t]/).map((s) => s.trim());
    let name = parts[0]; let reg: string | null = parts[1] || null;
    if (parts.length === 1 && l.includes(",")) { const p2 = l.split(",").map((s) => s.trim()); if (p2.length === 2 && /^[\w.-]+$/.test(p2[1]) && /\d/.test(p2[1])) { name = p2[0]; reg = p2[1]; } }
    rows.push({ line: i + 1, name, registration: reg });
  });
  return rows;
}

/** Prévia de importação: nada é gravado até o professor confirmar (PRD cap. 17/18). */
export async function previewStudents(classId: string, text: string): Promise<{ rows: StudentRow[] } | { error: string }> {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const parsed = parseStudentLines(text);
  if (!parsed.length) return { error: "Cole ao menos um nome." };
  if (parsed.length > 1000) return { error: "Limite de 1.000 linhas por importação." };
  const orgStudents = await db.select().from(students).where(eq(students.orgId, cls.orgId));
  const inClass = await classStudents(cls.id);
  const inClassIds = new Set(inClass.map((s) => s.id));
  const seen = new Set<string>();
  const seenNames = new Map<string, string | null>();
  const rows: StudentRow[] = parsed.map((r) => {
    if (!r.name || r.name.length < 2) return { ...r, status: "erro", message: "Nome vazio ou muito curto.", include: false };
    if (r.name.length > 160) return { ...r, status: "erro", message: "Nome muito longo.", include: false };
    const nk = normalize(r.name).replace(/\s+/g, " ");
    const dupKey = `${nk}|${r.registration ?? ""}`;
    if (seen.has(dupKey)) return { ...r, status: "repetido", message: "Linha repetida nesta lista.", include: false };
    seen.add(dupKey);
    const earlier = seenNames.has(nk);
    seenNames.set(nk, r.registration);
    const sameReg = r.registration ? orgStudents.find((s) => s.registration === r.registration) : undefined;
    if (sameReg) return { ...r, status: "repetido", message: inClassIds.has(sameReg.id) ? "Matrícula já está nesta turma." : `Matrícula já cadastrada na escola (${sameReg.name}).`, include: false };
    if (earlier) return { ...r, status: "homonimo", message: "Mesmo nome de outra linha da lista (matrículas diferentes). A fusão nunca é automática — confirme se é outra pessoa.", include: false };
    const sameName = orgStudents.filter((s) => normalize(s.name).replace(/\s+/g, " ") === nk);
    if (sameName.length) return { ...r, status: "homonimo", message: "Já existe aluno com este nome. A fusão nunca é automática — confirme se é outra pessoa.", include: false };
    return { ...r, status: "novo", include: true };
  });
  return { rows };
}

export async function commitStudents(classId: string, rows: { name: string; registration: string | null }[]) {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const clean = rows.filter((r) => r.name?.trim().length >= 2).slice(0, 1000);
  if (!clean.length) return { error: "Nada a importar." };
  const created = await db.insert(students).values(clean.map((r) => ({ orgId: cls.orgId, name: r.name.trim().slice(0, 160), registration: r.registration?.trim() || null }))).returning();
  await db.insert(enrollments).values(created.map((s) => ({ classId: cls.id, studentId: s.id }))).onConflictDoNothing();
  await audit(ctx.user.id, ctx.org.id, "students.imported", cls.id, { count: created.length });
  revalidatePath(`/app/turmas/${cls.id}`);
  return { ok: `${created.length} aluno(s) adicionado(s).` };
}

export async function addStudentAction(classId: string, _: FormState, fd: FormData): Promise<FormState> {
  const name = String(fd.get("name") ?? "").trim();
  const registration = String(fd.get("registration") ?? "").trim() || null;
  const prev = await previewStudents(classId, registration ? `${name};${registration}` : name);
  if ("error" in prev) return prev;
  const r = prev.rows[0];
  if (r.status === "erro") return { error: r.message };
  if (r.status === "repetido") return { error: r.message };
  if (r.status === "homonimo" && fd.get("confirmHomonym") !== "on") return { error: `${r.message} Marque “É outra pessoa” para adicionar.` };
  const res = await commitStudents(classId, [{ name, registration }]);
  return "error" in res ? { error: res.error } : { ok: res.ok };
}

export async function removeStudentAction(classId: string, studentId: string, mode: "transferred" | "remove") {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  if (mode === "transferred") await db.update(enrollments).set({ status: "transferred" }).where(and(eq(enrollments.classId, cls.id), eq(enrollments.studentId, studentId)));
  else await db.delete(enrollments).where(and(eq(enrollments.classId, cls.id), eq(enrollments.studentId, studentId)));
  await audit(ctx.user.id, ctx.org.id, `student.${mode}`, studentId);
  revalidatePath(`/app/turmas/${cls.id}/alunos`);
}

/* ---------- Observações e diário ---------- */
export async function addObservationAction(classId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const p = z.object({ text: z.string().trim().min(3, "Escreva a observação.").max(4000), studentId: z.string().optional(), observedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(todayISO()), visibility: z.enum(["private", "school"]).default("private") }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const studentId: string | null = p.data.studentId || null;
  if (studentId) {
    const ok = (await classStudents(cls.id)).some((s) => s.id === studentId);
    if (!ok) return { error: "Aluno não pertence a esta turma." };
  }
  await db.insert(observations).values({ classId: cls.id, studentId, authorId: ctx.user.id, text: p.data.text, observedOn: p.data.observedOn, visibility: p.data.visibility });
  revalidatePath(`/app/turmas/${cls.id}/observacoes`);
  return { ok: "Observação salva." };
}

export async function addLessonLogAction(classId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const p = z.object({ content: z.string().trim().min(3, "Descreva o que aconteceu na aula.").max(4000), taughtOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(todayISO()), planned: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const topics = fd.getAll("topics").map(String);
  await db.insert(lessonLogs).values({ classId: cls.id, authorId: ctx.user.id, taughtOn: p.data.taughtOn, content: p.data.content, topics, planned: p.data.planned === "on" });
  revalidatePath(`/app/turmas/${cls.id}`);
  return { ok: "Aula registrada. Os conteúdos confirmados passam a sugerir o escopo da próxima prova." };
}

/* ---------- Notas ---------- */
const PERIOD_ERR = "Este período está fechado. Reabra para editar.";

export async function createGradeItemAction(classId: string, period: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const p = z.object({
    title: z.string().trim().min(1, "Informe o nome da atividade.").max(100),
    category: z.string().default("prova"),
    weight: z.string().transform((v) => Number(v.replace(",", "."))).pipe(z.number().positive("O peso deve ser maior que zero.")),
    maxPoints: z.string().transform((v) => Number(v.replace(",", "."))).pipe(z.number().positive("Informe a pontuação máxima.")),
    recovery: z.string().optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const rules = rulesFrom(ctx.org.settings);
  const gb = await loadGradebook(cls.id, period, rules);
  if (gb.closed) return { error: PERIOD_ERR };
  await db.insert(gradeItems).values({ classId: cls.id, title: p.data.title, category: p.data.category, period, weight: String(p.data.weight), maxPoints: String(p.data.maxPoints), recovery: p.data.recovery === "on" });
  revalidatePath(`/app/turmas/${cls.id}/notas`);
  return { ok: "Atividade criada." };
}

export async function deleteGradeItemAction(classId: string, itemId: string) {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const [it] = await db.select().from(gradeItems).where(and(eq(gradeItems.id, itemId), eq(gradeItems.classId, cls.id))).limit(1);
  if (!it) return;
  const gb = await loadGradebook(cls.id, it.period, rulesFrom(ctx.org.settings));
  if (gb.closed) return;
  await db.delete(gradeItems).where(eq(gradeItems.id, itemId));
  await audit(ctx.user.id, ctx.org.id, "gradeitem.deleted", itemId);
  revalidatePath(`/app/turmas/${cls.id}/notas`);
}

/** Grava (ou valida) uma célula. Campo vazio fica pendente — nunca vira zero por padrão. */
export async function saveGrade(classId: string, itemId: string, studentId: string, raw: string, opts: { source?: string; reason?: string } = {}) {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  if (!/^[0-9a-f-]{36}$/i.test(itemId) || !/^[0-9a-f-]{36}$/i.test(studentId)) return { error: "Registro inválido." };
  const [it] = await db.select().from(gradeItems).where(and(eq(gradeItems.id, itemId), eq(gradeItems.classId, cls.id))).limit(1);
  if (!it) return { error: "Atividade não encontrada." };
  const closed = await db.select().from(periodCloses).where(and(eq(periodCloses.classId, cls.id), eq(periodCloses.period, it.period))).limit(1);
  if (closed[0] && !closed[0].reopenedAt) return { error: PERIOD_ERR };
  const enrolled = (await classStudents(cls.id)).some((s) => s.id === studentId);
  if (!enrolled) return { error: "Aluno não pertence a esta turma." };
  const parsed = parseGradeInput(raw, Number(it.maxPoints));
  if ("error" in parsed) return { error: parsed.error };
  const [before] = await db.select().from(grades).where(and(eq(grades.gradeItemId, itemId), eq(grades.studentId, studentId))).limit(1);
  const after = { state: parsed.state, value: parsed.value };
  if (before && before.state === after.state && Number(before.value ?? -1) === Number(after.value ?? -1)) return { ok: true as const };
  await db.insert(grades).values({ gradeItemId: itemId, studentId, state: parsed.state, value: parsed.value == null ? null : String(parsed.value), source: opts.source ?? "manual", updatedBy: ctx.user.id })
    .onConflictDoUpdate({ target: [grades.gradeItemId, grades.studentId], set: { state: parsed.state, value: parsed.value == null ? null : String(parsed.value), source: opts.source ?? "manual", updatedBy: ctx.user.id, updatedAt: new Date() } });
  await db.insert(gradeChanges).values({ gradeItemId: itemId, studentId, before: before ? { state: before.state, value: before.value } : null, after, actorId: ctx.user.id, source: opts.source ?? "manual", reason: opts.reason });
  return { ok: true as const };
}

export async function saveGradesBatch(classId: string, entries: { itemId: string; studentId: string; raw: string }[]) {
  const results: { itemId: string; studentId: string; error?: string }[] = [];
  for (const e of entries.slice(0, 600)) {
    const r = await saveGrade(classId, e.itemId, e.studentId, e.raw, { source: "manual" });
    results.push({ itemId: e.itemId, studentId: e.studentId, error: "error" in r ? r.error : undefined });
  }
  revalidatePath(`/app/turmas/${classId}/notas`);
  return results;
}

export async function averagesFor(classId: string, period: string) {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const gb = await loadGradebook(cls.id, period, rulesFrom(ctx.org.settings));
  return gb.rows.map((r) => ({ studentId: r.student.id, average: r.computed.average, partial: r.computed.partial, formula: r.computed.formula }));
}

export async function closePeriodAction(classId: string, period: string) {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  await db.insert(periodCloses).values({ classId: cls.id, period, closedBy: ctx.user.id }).onConflictDoUpdate({ target: [periodCloses.classId, periodCloses.period], set: { closedBy: ctx.user.id, closedAt: new Date(), reopenedAt: null } });
  await audit(ctx.user.id, ctx.org.id, "period.closed", cls.id, { period });
  revalidatePath(`/app/turmas/${cls.id}/notas`);
}

export async function reopenPeriodAction(classId: string, period: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls, role } = await loadClass(ctx, classId);
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Informe o motivo da reabertura." };
  const authorized = ctx.org.kind === "personal" || role === "coordinator" || role === "admin";
  if (!authorized) return { error: "A reabertura de período em escola exige a coordenação." };
  await db.update(periodCloses).set({ reopenedAt: new Date() }).where(and(eq(periodCloses.classId, cls.id), eq(periodCloses.period, period)));
  await audit(ctx.user.id, ctx.org.id, "period.reopened", cls.id, { period, reason });
  revalidatePath(`/app/turmas/${cls.id}/notas`);
  return { ok: "Período reaberto. A alteração fica registrada." };
}
