import "server-only";
import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { xpEvents, achievementUnlocks, missionClaims, orgs, calendarEvents, enrollments } from "@/db/schema";
import { ACHIEVEMENTS, MISSIONS, XP_RULES, computeStreak, levelProgress, leagueOf, missionProgress, newlyUnlocked, periodKey, periodRange, type Counters } from "@/lib/core/gamification";
import { addDaysISO, expand, fromSP } from "@/lib/core/calendar";
import { todayISO } from "@/lib/format";
import { notifyPortal } from "@/lib/portal-notify";

const REWARD_KINDS = ["achievement", "mission"];

export async function gamificationOn(orgId: string): Promise<boolean> {
  const [o] = await db.select({ s: orgs.settings }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
  return o?.s?.gamification?.enabled ?? true;
}

/**
 * Concede XP de forma idempotente: o par (estudante, refKey) só entra uma vez, então reenvio, refresh ou repetição
 * do evento não duplicam pontos. Depois reavalia conquistas e missões. Nunca remove XP.
 */
export async function awardXp(a: { orgId: string; studentId: string; kind: string; refKey: string; points: number; label: string }): Promise<boolean> {
  try {
    if (!(await gamificationOn(a.orgId))) return false;
    const ins = await db.insert(xpEvents).values({ orgId: a.orgId, studentId: a.studentId, kind: a.kind, points: a.points, refKey: a.refKey, day: todayISO(), label: a.label }).onConflictDoNothing().returning({ id: xpEvents.id });
    if (!ins.length) return false;
    await evaluate(a.orgId, a.studentId);
    return true;
  } catch (e) { console.error("gamificação falhou", e); return false; } // engajamento nunca quebra o fluxo principal
}

async function counters(studentId: string, orgId: string): Promise<Counters> {
  const rows = await db.select({ kind: xpEvents.kind, day: xpEvents.day, points: xpEvents.points }).from(xpEvents).where(eq(xpEvents.studentId, studentId));
  const today = todayISO();
  const activity = new Set(rows.filter((r) => !REWARD_KINDS.includes(r.kind)).map((r) => r.day));
  const from = addDaysISO(today, -60);
  const hol = await db.select().from(calendarEvents).where(and(eq(calendarEvents.orgId, orgId), eq(calendarEvents.scope, "school"), eq(calendarEvents.category, "feriado")));
  const pause = new Set<string>();
  for (const o of expand(hol.map((h) => ({ id: h.id, title: h.title, category: h.category, scope: h.scope, startsAt: h.startsAt, endsAt: h.endsAt, allDay: h.allDay, recurrence: h.recurrence })), fromSP(from), fromSP(today, "23:59")))
    pause.add(new Date(o.start.getTime() - 3 * 3600e3).toISOString().slice(0, 10));
  const n = (f: (k: string) => boolean) => rows.filter((r) => f(r.kind)).length;
  return {
    access: n((k) => k === "access"), tasks: n((k) => k === "task_on_time" || k === "task_late"), tasksOnTime: n((k) => k === "task_on_time"),
    perfect: n((k) => k === "task_graded_perfect" || k === "quiz_perfect"), quizzes: n((k) => k === "quiz_done"), attendance: n((k) => k === "attendance"),
    studyDays: new Set(rows.filter((r) => r.kind === "access").map((r) => r.day)).size, xp: rows.reduce((s, r) => s + r.points, 0), streak: computeStreak(activity, today, pause),
  };
}

/** Desbloqueia conquistas e conclui missões (cada uma uma única vez) e credita as recompensas. */
async function evaluate(orgId: string, studentId: string) {
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    const c = await counters(studentId, orgId);
    const have = new Set((await db.select({ id: achievementUnlocks.achievementId }).from(achievementUnlocks).where(eq(achievementUnlocks.studentId, studentId))).map((r) => r.id));
    for (const a of newlyUnlocked(c, have)) {
      const ins = await db.insert(achievementUnlocks).values({ studentId, achievementId: a.id }).onConflictDoNothing().returning();
      if (!ins.length) continue;
      changed = true;
      await db.insert(xpEvents).values({ orgId, studentId, kind: "achievement", points: a.reward, refKey: `ach:${a.id}`, day: todayISO(), label: `Conquista: ${a.name}` }).onConflictDoNothing();
      await notifyPortal([studentId], "conquista", `Conquista desbloqueada: ${a.name}`, `+${a.reward} XP`, "/portal/conquistas", { groupKey: `ach:${a.id}:${studentId}` });
    }
    const today = todayISO();
    for (const m of MISSIONS) {
      const { from, to } = periodRange(m, today);
      const ev = await db.select({ kind: xpEvents.kind, day: xpEvents.day }).from(xpEvents).where(and(eq(xpEvents.studentId, studentId), gte(xpEvents.day, from), lte(xpEvents.day, to)));
      if (!missionProgress(m, ev).done) continue;
      const ins = await db.insert(missionClaims).values({ studentId, missionId: m.id, periodKey: periodKey(m, today) }).onConflictDoNothing().returning();
      if (!ins.length) continue;
      changed = true;
      await db.insert(xpEvents).values({ orgId, studentId, kind: "mission", points: m.reward, refKey: `mission:${m.id}:${periodKey(m, today)}`, day: today, label: `Missão: ${m.name}` }).onConflictDoNothing();
      await notifyPortal([studentId], "conquista", `Missão concluída: ${m.name}`, `+${m.reward} XP`, "/portal/conquistas", { groupKey: `mis:${m.id}:${studentId}` });
    }
    if (!changed) break;
  }
}

export async function studentProfile(orgId: string, studentId: string) {
  const c = await counters(studentId, orgId);
  const today = todayISO();
  const unlocked = await db.select().from(achievementUnlocks).where(eq(achievementUnlocks.studentId, studentId));
  const missions = [];
  for (const m of MISSIONS) {
    const { from, to } = periodRange(m, today);
    const ev = await db.select({ kind: xpEvents.kind, day: xpEvents.day }).from(xpEvents).where(and(eq(xpEvents.studentId, studentId), gte(xpEvents.day, from), lte(xpEvents.day, to)));
    missions.push({ m, ...missionProgress(m, ev) });
  }
  const history = await db.select().from(xpEvents).where(eq(xpEvents.studentId, studentId)).orderBy(sql`${xpEvents.createdAt} desc`).limit(30);
  return { counters: c, xp: c.xp, level: levelProgress(c.xp), league: leagueOf(c.xp), streak: c.streak, unlocked: new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt])), missions, history, achievements: ACHIEVEMENTS };
}

/** XP total por estudante da turma (ranking opcional e painel do professor). */
export async function classXp(classId: string) {
  const roster = await db.select({ s: enrollments.studentId }).from(enrollments).where(and(eq(enrollments.classId, classId), eq(enrollments.status, "active")));
  const ids = roster.map((r) => r.s);
  if (!ids.length) return new Map<string, number>();
  const rows = await db.select({ s: xpEvents.studentId, xp: sql<number>`coalesce(sum(${xpEvents.points}), 0)::int` }).from(xpEvents).where(inArray(xpEvents.studentId, ids)).groupBy(xpEvents.studentId);
  return new Map(rows.map((r) => [r.s, Number(r.xp)]));
}
export { XP_RULES };
