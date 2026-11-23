import "server-only";
import { and, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, timetableSlots, classes, notifications } from "@/db/schema";
import { expand, type EventLike, type Occurrence } from "@/lib/core/calendar";
import { notify } from "@/lib/audit";
import { anyOf } from "@/lib/util";

/** Eventos visíveis: da escola, das turmas indicadas e pessoais do próprio usuário. */
export async function loadOccurrences(opts: { orgId: string; userId: string; classIds: string[]; from: Date; to: Date }): Promise<Occurrence[]> {
  const rows = await db.select().from(calendarEvents).where(and(
    eq(calendarEvents.orgId, opts.orgId),
    lte(calendarEvents.startsAt, opts.to),
    or(gte(calendarEvents.startsAt, opts.from), isNotNull(calendarEvents.recurrence)),
    or(eq(calendarEvents.scope, "school"), and(eq(calendarEvents.scope, "class"), inArray(calendarEvents.classId, anyOf(opts.classIds))), and(eq(calendarEvents.scope, "personal"), eq(calendarEvents.ownerId, opts.userId))),
  ));
  return expand(rows.map((r): EventLike => ({ id: r.id, title: r.title, category: r.category, scope: r.scope, classId: r.classId, startsAt: r.startsAt, endsAt: r.endsAt, allDay: r.allDay, recurrence: r.recurrence, reminderMin: r.reminderMin })), opts.from, opts.to);
}

export async function loadSlots(orgId: string, classIds: string[]) {
  return db.select({ s: timetableSlots, className: classes.name }).from(timetableSlots).innerJoin(classes, eq(classes.id, timetableSlots.classId))
    .where(and(eq(timetableSlots.orgId, orgId), inArray(timetableSlots.classId, anyOf(classIds)))).orderBy(timetableSlots.weekday, timetableSlots.startTime);
}

/** Lembretes sem agendador: ao abrir o início, cria o aviso das ocorrências nas próximas 48 h cuja janela de lembrete já abriu. Idempotente por ocorrência. */
export async function ensureReminders(opts: { orgId: string; userId: string; classIds: string[]; href: string }) {
  const now = new Date();
  const occ = await loadOccurrences({ orgId: opts.orgId, userId: opts.userId, classIds: opts.classIds, from: now, to: new Date(now.getTime() + 48 * 3600e3) });
  for (const o of occ) {
    if (o.reminderMin == null) continue;
    if (now.getTime() < o.start.getTime() - o.reminderMin * 60e3) continue;
    const groupKey = `rem:${o.key}`;
    const [ex] = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, opts.userId), eq(notifications.groupKey, groupKey))).limit(1);
    if (ex) continue;
    await notify(opts.userId, "evento", `Lembrete: ${o.title}`, undefined, opts.href, { groupKey });
  }
}

export type AgendaItem = { key: string; title: string; category: string; scope: string; start: Date; end: Date | null; allDay: boolean; href?: string };

/** Agenda da semana: eventos (com recorrência) visíveis ao usuário. */
export async function loadAgenda(opts: { orgId: string; userId: string; classIds: string[]; from: Date; to: Date }): Promise<AgendaItem[]> {
  const occ = await loadOccurrences(opts);
  return occ.map((o) => ({ key: o.key, title: o.title, category: o.category, scope: o.scope, start: o.start, end: o.end, allDay: o.allDay }));
}
