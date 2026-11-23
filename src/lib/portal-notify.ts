import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { studentAccounts, guardianLinks } from "@/db/schema";
import { notify, type NotifyCategory } from "@/lib/audit";

/** Contas (aluno e responsáveis) que enxergam estes estudantes. */
export async function portalUserIds(studentIds: string[]): Promise<string[]> {
  if (!studentIds.length) return [];
  const [a, g] = await Promise.all([
    db.select({ u: studentAccounts.userId }).from(studentAccounts).where(inArray(studentAccounts.studentId, studentIds)),
    db.select({ u: guardianLinks.userId }).from(guardianLinks).where(inArray(guardianLinks.studentId, studentIds)),
  ]);
  return [...new Set([...a.map((x) => x.u), ...g.map((x) => x.u)])];
}

/** Avisa quem acompanha os estudantes. O texto é genérico; o link leva a uma página que checa a permissão de novo. */
export async function notifyPortal(studentIds: string[], category: NotifyCategory, title: string, body: string | undefined, href: string, opts: { groupKey?: string; priority?: "normal" | "high" } = {}) {
  const users = await portalUserIds(studentIds);
  await Promise.all(users.map((u) => notify(u, category, title, body, href, opts)));
}
