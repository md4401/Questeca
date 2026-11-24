import "server-only";
import { and, eq, inArray, count, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications, assessments, enrollments, gradeItems, grades } from "@/db/schema";

import { atividadesPendentes } from "@/lib/core/indicadores";

export type Indicadores = { turmas: number; alunos: number; provasCriadas: number; provasAplicadas: number; atividadesPendentes: number };

/** Números do painel do Início, só do professor logado (turmas que enxerga, provas que criou e aplicou). */
export async function loadIndicadores(a: { orgId: string; userId: string; classIds: string[] }): Promise<Indicadores> {
  const { classIds } = a;
  const [criadas] = await db.select({ n: count() }).from(assessments).where(and(eq(assessments.orgId, a.orgId), eq(assessments.ownerId, a.userId)));
  const [aplicadas] = await db.select({ n: count() }).from(applications).innerJoin(assessments, eq(assessments.id, applications.assessmentId)).where(and(eq(assessments.orgId, a.orgId), eq(assessments.ownerId, a.userId)));
  if (!classIds.length) return { turmas: 0, alunos: 0, provasCriadas: Number(criadas?.n ?? 0), provasAplicadas: Number(aplicadas?.n ?? 0), atividadesPendentes: 0 };
  const ativos = await db.select({ classId: enrollments.classId, n: count() }).from(enrollments).where(and(inArray(enrollments.classId, classIds), eq(enrollments.status, "active"))).groupBy(enrollments.classId);
  const ativosPorTurma = new Map(ativos.map((r) => [r.classId, Number(r.n)]));
  const itens = await db.select({ id: gradeItems.id, classId: gradeItems.classId }).from(gradeItems).where(inArray(gradeItems.classId, classIds));
  const lanc = itens.length ? await db.select({ itemId: grades.gradeItemId, n: sql<number>`count(*)::int` }).from(grades).where(and(inArray(grades.gradeItemId, itens.map((i) => i.id)), sql`${grades.state} <> 'pending'`)).groupBy(grades.gradeItemId) : [];
  return {
    turmas: classIds.length,
    alunos: [...ativosPorTurma.values()].reduce((s, n) => s + n, 0),
    provasCriadas: Number(criadas?.n ?? 0),
    provasAplicadas: Number(aplicadas?.n ?? 0),
    atividadesPendentes: atividadesPendentes(itens, ativosPorTurma, new Map(lanc.map((r) => [r.itemId, Number(r.n)]))),
  };
}
