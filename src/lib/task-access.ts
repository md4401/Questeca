import "server-only";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import type { Ctx } from "@/lib/session";
import { loadClass } from "@/lib/access";

/** Tarefa da turma, só para quem tem acesso pedagógico à turma. */
export async function loadTaskForStaff(ctx: Ctx, classId: string, taskId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) notFound();
  const { cls } = await loadClass(ctx, classId);
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.classId, cls.id))).limit(1);
  if (!task) notFound();
  return { cls, task };
}

/** "2026-03-10T14:30" (horário de Brasília) → Date. */
export function parseLocalSP(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
export const toLocalSP = (d: Date | null) => (d ? new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 16) : "");
export const MAX_FILE = 4 * 1024 * 1024;
