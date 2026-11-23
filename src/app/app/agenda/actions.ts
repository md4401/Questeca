"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { calendarEvents, timetableSlots, classTeachers } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { fromSP, validTime, slotConflicts, type Slot } from "@/lib/core/calendar";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/form";

const isOrgManager = (role: string) => role === "coordinator" || role === "admin";

export async function createEventAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const p = z.object({
    title: z.string().trim().min(2, "Informe o título.").max(160), description: z.string().trim().max(1000).optional(),
    category: z.enum(["prova", "trabalho", "evento", "feriado", "reuniao", "atividade"]), scope: z.enum(["personal", "class", "school"]),
    classId: z.string().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
    startTime: z.string().optional(), endTime: z.string().optional(),
    freq: z.enum(["none", "daily", "weekly", "monthly"]).default("none"), until: z.string().optional(), reminder: z.string().optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data; const allDay = fd.get("allDay") === "on";
  if (!allDay && (!d.startTime || !validTime(d.startTime))) return { error: "Informe o horário de início ou marque “dia todo”." };
  if (d.endTime && !validTime(d.endTime)) return { error: "Horário de término inválido." };
  if (d.endTime && d.startTime && d.endTime <= d.startTime) return { error: "O término deve ser depois do início." };
  let classId: string | null = null;
  if (d.scope === "class") { if (!d.classId) return { error: "Escolha a turma." }; classId = (await loadClass(ctx, d.classId)).cls.id; }
  if (d.scope === "school" && !(isOrgManager(ctx.org.role) || ctx.org.kind === "personal")) return { error: "Só a coordenação ou gestão cria eventos para toda a escola." };
  if (d.freq !== "none" && (!d.until || d.until < d.date)) return { error: "Informe até quando o evento se repete." };
  const startsAt = fromSP(d.date, allDay ? "00:00" : d.startTime!);
  const endsAt = !allDay && d.endTime ? fromSP(d.date, d.endTime) : null;
  const [ev] = await db.insert(calendarEvents).values({
    orgId: ctx.org.id, scope: d.scope, classId, ownerId: d.scope === "personal" ? ctx.user.id : null, title: d.title, description: d.description || null, category: d.category,
    startsAt, endsAt, allDay, recurrence: d.freq === "none" ? null : { freq: d.freq, until: d.until! }, reminderMin: d.reminder ? Number(d.reminder) || null : null, createdBy: ctx.user.id,
  }).returning();
  await audit(ctx.user.id, ctx.org.id, "event.created", ev.id);
  revalidatePath("/app/agenda");
  return { ok: "Evento criado." };
}

export async function deleteEventAction(id: string) {
  const ctx = await requireCtx();
  const [e] = await db.select().from(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.orgId, ctx.org.id))).limit(1);
  if (!e) return;
  if (e.createdBy !== ctx.user.id && !isOrgManager(ctx.org.role)) return;
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  await audit(ctx.user.id, ctx.org.id, "event.deleted", id);
  revalidatePath("/app/agenda");
}

export async function createSlotAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const p = z.object({ classId: z.string().uuid("Escolha a turma."), weekday: z.coerce.number().int().min(1).max(7), startTime: z.string(), endTime: z.string(), room: z.string().trim().max(60).optional(), teacherId: z.string().optional(), subject: z.string().trim().max(60).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (!validTime(d.startTime) || !validTime(d.endTime)) return { error: "Informe horários no formato HH:MM." };
  if (d.endTime <= d.startTime) return { error: "O término deve ser depois do início." };
  const { cls } = await loadClass(ctx, d.classId);
  let teacherId: string | null = ctx.user.id;
  if (d.teacherId && d.teacherId !== ctx.user.id) {
    if (!isOrgManager(ctx.org.role)) return { error: "Só a coordenação define outro professor." };
    const ct = await db.select({ u: classTeachers.userId }).from(classTeachers).where(and(eq(classTeachers.classId, cls.id), eq(classTeachers.userId, d.teacherId))).limit(1);
    if (!ct[0]) return { error: "Este professor não está atribuído à turma." };
    teacherId = d.teacherId;
  }
  const slot: Slot = { classId: cls.id, teacherId, room: d.room || null, weekday: d.weekday, startTime: d.startTime, endTime: d.endTime };
  const existing = await db.select().from(timetableSlots).where(eq(timetableSlots.orgId, ctx.org.id));
  const conflicts = slotConflicts(slot, existing.map((s) => ({ id: s.id, classId: s.classId, teacherId: s.teacherId, room: s.room, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime })));
  if (conflicts.length) return { error: `Conflito de horário: ${[...new Set(conflicts.map((c) => c.kind))].join(", ")} já ocupado(a) nesse intervalo (${conflicts[0].with.startTime}–${conflicts[0].with.endTime}).` };
  await db.insert(timetableSlots).values({ orgId: ctx.org.id, classId: cls.id, subject: d.subject || cls.subject, teacherId, weekday: d.weekday, startTime: d.startTime, endTime: d.endTime, room: d.room || null, createdBy: ctx.user.id });
  revalidatePath("/app/horarios");
  return { ok: "Horário adicionado." };
}

export async function deleteSlotAction(id: string) {
  const ctx = await requireCtx();
  const [s] = await db.select().from(timetableSlots).where(and(eq(timetableSlots.id, id), eq(timetableSlots.orgId, ctx.org.id))).limit(1);
  if (!s) return;
  await loadClass(ctx, s.classId); // só quem tem acesso à turma
  await db.delete(timetableSlots).where(eq(timetableSlots.id, id));
  revalidatePath("/app/horarios");
}
