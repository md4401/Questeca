"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orgs, memberships, invitations, classes, classTeachers, subscriptions, type OrgSettings } from "@/db/schema";
import { requireCtx, setActiveOrg, type Ctx } from "@/lib/session";
import { can, type Role } from "@/lib/core/permissions";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendMail, layoutMail, emailEnabled } from "@/lib/email";
import { env } from "@/lib/env";
import { audit, notify } from "@/lib/audit";
import { escapeHtml } from "@/lib/auth-core";
import { DEFAULT_PERIODS } from "@/lib/gradebook";
import type { FormState } from "@/components/form";

function canEditSettings(ctx: Ctx) {
  return ctx.org.kind === "personal" || can(ctx.org.role, "org.templates");
}

export async function createSchoolAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 3) return { error: "Informe o nome da escola." };
  const [org] = await db.insert(orgs).values({ name, kind: "school", ownerId: ctx.user.id, settings: { header: { schoolName: name } } }).returning();
  await db.insert(memberships).values({ orgId: org.id, userId: ctx.user.id, role: "admin" });
  const now = new Date();
  // Teste de 60 dias com limites de implantação; o contrato define os limites finais (ver PENDING.md).
  await db.insert(subscriptions).values({ orgId: org.id, plan: "school", status: "active", periodStart: now, periodEnd: new Date(now.getTime() + 60 * 864e5), limits: { assemblies: 60, classes: 30, cards: 500 } });
  await setActiveOrg(ctx.sessionId, org.id);
  await audit(ctx.user.id, org.id, "school.created", org.id);
  redirect("/app/escola");
}

export async function saveHeaderAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  if (!canEditSettings(ctx)) return { error: "Seu papel não permite alterar modelos." };
  const cur = ctx.org.settings;
  const header: NonNullable<OrgSettings["header"]> = {
    ...cur.header,
    schoolName: String(fd.get("schoolName") ?? "").trim().slice(0, 160),
    subtitle: String(fd.get("subtitle") ?? "").trim().slice(0, 200),
    teacherLabel: String(fd.get("teacherLabel") ?? "Professor(a)").trim().slice(0, 40),
    instructions: String(fd.get("instructions") ?? "").trim().slice(0, 600),
    footer: String(fd.get("footer") ?? "").trim().slice(0, 160),
    fields: fd.getAll("fields").map(String),
  };
  const logo = fd.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!/^image\/(png|jpe?g)$/.test(logo.type)) return { error: "O logo deve ser PNG ou JPG." };
    if (logo.size > 400_000) return { error: "Logo muito grande (máx. 400 KB)." };
    header.logoDataUrl = `data:${logo.type};base64,${Buffer.from(await logo.arrayBuffer()).toString("base64")}`;
  }
  if (fd.get("removeLogo") === "on") delete header.logoDataUrl;
  await db.update(orgs).set({ settings: { ...cur, header } }).where(eq(orgs.id, ctx.org.id));
  await audit(ctx.user.id, ctx.org.id, "org.header_saved");
  revalidatePath("/app");
  return { ok: "Modelo salvo. As próximas provas já usam este cabeçalho; PDFs anteriores permanecem ligados à versão emitida." };
}

export async function saveGradingAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  if (!canEditSettings(ctx)) return { error: "Seu papel não permite alterar regras de nota." };
  const p = z.object({
    scaleMax: z.coerce.number().positive().max(1000), passMark: z.coerce.number().min(0).max(1000),
    rounding: z.enum(["none", "half", "tenth", "up_half"]), absenceCounts: z.enum(["zero", "exclude"]), notDeliveredCounts: z.enum(["zero", "exclude"]),
    recovery: z.enum(["none", "replace_if_higher", "average", "independent"]), periods: z.string(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Confira os valores informados." };
  if (p.data.passMark > p.data.scaleMax) return { error: "A média de aprovação não pode ser maior que a escala." };
  const periods = p.data.periods.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  if (!periods.length) return { error: "Informe ao menos um período." };
  const cur = ctx.org.settings;
  await db.update(orgs).set({ settings: { ...cur, grading: { ...p.data, periods: periods.length ? periods : DEFAULT_PERIODS } } }).where(eq(orgs.id, ctx.org.id));
  await audit(ctx.user.id, ctx.org.id, "org.grading_saved", undefined, p.data);
  return { ok: "Regras salvas. Ao alterar regras, notas já finalizadas só mudam após reabertura autorizada." };
}

export async function inviteAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  if (ctx.org.kind !== "school" || !can(ctx.org.role, "org.invite")) return { error: "Somente a gestão institucional convida pessoas." };
  const p = z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido."), role: z.enum(["teacher", "coordinator", "admin"]) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const classIds = fd.getAll("classIds").map(String);
  if (classIds.length) {
    const valid = await db.select({ id: classes.id }).from(classes).where(eq(classes.orgId, ctx.org.id));
    if (classIds.some((c) => !valid.some((v) => v.id === c))) return { error: "Turma inválida." };
  }
  const token = randomToken(32);
  await db.insert(invitations).values({ orgId: ctx.org.id, email: p.data.email, role: p.data.role, classIds, tokenHash: sha256(token), invitedBy: ctx.user.id, expiresAt: new Date(Date.now() + 7 * 864e5) });
  const href = `${env.appUrl()}/convite/${token}`;
  await sendMail({ to: p.data.email, subject: `Convite para ${ctx.org.name} na Questeca`, html: layoutMail(`Convite para ${escapeHtml(ctx.org.name)}`, `<p>${escapeHtml(ctx.user.name)} convidou você para a escola <strong>${escapeHtml(ctx.org.name)}</strong> na Questeca.</p>`, { href, label: "Ver convite" }), text: `Convite: ${href}` });
  await audit(ctx.user.id, ctx.org.id, "invite.created", p.data.email);
  revalidatePath("/app/escola");
  return { ok: emailEnabled() ? "Convite enviado por e-mail (válido por 7 dias)." : `Convite criado. O envio de e-mail não está configurado — copie e envie este link: ${href}` };
}

export async function revokeInviteAction(id: string) {
  const ctx = await requireCtx();
  if (!can(ctx.org.role, "org.invite")) return;
  await db.update(invitations).set({ status: "revoked" }).where(and(eq(invitations.id, id), eq(invitations.orgId, ctx.org.id)));
  await audit(ctx.user.id, ctx.org.id, "invite.revoked", id);
  revalidatePath("/app/escola");
}

export async function changeRoleAction(memberId: string, role: Role) {
  const ctx = await requireCtx();
  if (!can(ctx.org.role, "org.manage")) return;
  const [m] = await db.select().from(memberships).where(and(eq(memberships.id, memberId), eq(memberships.orgId, ctx.org.id))).limit(1);
  if (!m || m.userId === ctx.user.id) return; // não rebaixa a si mesmo
  await db.update(memberships).set({ role }).where(eq(memberships.id, memberId));
  await audit(ctx.user.id, ctx.org.id, "member.role_changed", m.userId, { role });
  revalidatePath("/app/escola");
}

export async function removeMemberAction(memberId: string) {
  const ctx = await requireCtx();
  if (!can(ctx.org.role, "org.manage")) return;
  const [m] = await db.select().from(memberships).where(and(eq(memberships.id, memberId), eq(memberships.orgId, ctx.org.id))).limit(1);
  if (!m || m.userId === ctx.user.id) return;
  await db.update(memberships).set({ status: "removed" }).where(eq(memberships.id, memberId));
  const cs = await db.select({ id: classes.id }).from(classes).where(eq(classes.orgId, ctx.org.id));
  for (const c of cs) await db.delete(classTeachers).where(and(eq(classTeachers.classId, c.id), eq(classTeachers.userId, m.userId)));
  await notify(m.userId, "seguranca", "Seu acesso a uma escola foi removido", ctx.org.name);
  await audit(ctx.user.id, ctx.org.id, "member.removed", m.userId);
  revalidatePath("/app/escola");
}

export async function assignClassAction(classId: string, userId: string, assign: boolean) {
  const ctx = await requireCtx();
  if (!can(ctx.org.role, "org.manage") && ctx.org.role !== "coordinator") return;
  const [c] = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.orgId, ctx.org.id))).limit(1);
  const [m] = await db.select().from(memberships).where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.userId, userId), eq(memberships.status, "active"))).limit(1);
  if (!c || !m) return;
  if (assign) await db.insert(classTeachers).values({ classId, userId }).onConflictDoNothing();
  else await db.delete(classTeachers).where(and(eq(classTeachers.classId, classId), eq(classTeachers.userId, userId)));
  await audit(ctx.user.id, ctx.org.id, assign ? "class.teacher_assigned" : "class.teacher_unassigned", classId, { userId });
  revalidatePath("/app/escola");
}

export async function leaveOrgAction() {
  const ctx = await requireCtx();
  if (ctx.org.kind !== "school") return;
  const personal = ctx.orgs.find((o) => o.kind === "personal");
  const admins = await db.select().from(memberships).where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.role, "admin"), eq(memberships.status, "active")));
  if (ctx.org.role === "admin" && admins.length <= 1) redirect("/app/escola?erro=" + encodeURIComponent("Você é o único administrador. Convide outro administrador antes de sair."));
  await db.update(memberships).set({ status: "removed" }).where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.userId, ctx.user.id)));
  const cs = await db.select({ id: classes.id }).from(classes).where(eq(classes.orgId, ctx.org.id));
  for (const c of cs) await db.delete(classTeachers).where(and(eq(classTeachers.classId, c.id), eq(classTeachers.userId, ctx.user.id)));
  await audit(ctx.user.id, ctx.org.id, "member.left");
  if (personal) await setActiveOrg(ctx.sessionId, personal.id);
  redirect("/app");
}


/** Regras do portal: comunicação, engajamento e faixas de alerta. Só quem edita regras da escola. */
export async function savePortalSettingsAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  if (!canEditSettings(ctx)) return { error: "Seu papel não permite alterar estas regras." };
  const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal("")).optional();
  const p = z.object({ hoursFrom: time, hoursTo: time, minAttendance: z.coerce.number().min(0).max(100), minAverage: z.coerce.number().min(0).max(1000), maxLateTasks: z.coerce.number().int().min(0).max(50) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Confira os valores (horários no formato HH:MM)." };
  if ((p.data.hoursFrom && !p.data.hoursTo) || (!p.data.hoursFrom && p.data.hoursTo)) return { error: "Informe o início e o fim do horário de atendimento, ou deixe os dois vazios." };
  if (p.data.hoursFrom && p.data.hoursTo && p.data.hoursTo <= p.data.hoursFrom) return { error: "O fim do atendimento deve ser depois do início." };
  const cur = ctx.org.settings;
  const chat = { studentToStaff: fd.get("studentToStaff") === "on", guardianToStaff: fd.get("guardianToStaff") === "on", classGroups: fd.get("classGroups") === "on", hoursFrom: p.data.hoursFrom || undefined, hoursTo: p.data.hoursTo || undefined };
  const gamification = { enabled: fd.get("gamEnabled") === "on", leaderboard: fd.get("leaderboard") === "on" };
  const risk = { minAttendance: p.data.minAttendance, minAverage: p.data.minAverage, maxLateTasks: p.data.maxLateTasks };
  await db.update(orgs).set({ settings: { ...cur, chat, gamification, risk } }).where(eq(orgs.id, ctx.org.id));
  await audit(ctx.user.id, ctx.org.id, "org.portal_settings_saved", undefined, { chat, gamification, risk });
  return { ok: "Regras do portal salvas." };
}
