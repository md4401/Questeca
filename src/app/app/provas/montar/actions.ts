"use server";
import { redirect } from "next/navigation";
import { and, eq, or, ilike, isNull, isNotNull, inArray, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assessments, assessmentItems, questions } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { evenPoints, usedQuestionIdsForClass } from "@/lib/assessments";
import { consumeAssembly } from "@/lib/billing";
import { aiAvailable, aiExpandThemes } from "@/lib/ai";
import { parseQuery, scoreDoc, norm } from "@/lib/core/search";
import { subjectLabel, gradeLabel } from "@/lib/taxonomy";
import { audit, track } from "@/lib/audit";
import type { FormState } from "@/components/form";

/** Dificuldade-alvo (1 a 5) pela série. As questões do banco têm dificuldade 3 por padrão, então é só uma preferência. */
const DIFICULDADE_POR_SERIE: Record<string, number> = { "6": 1, "7": 2, "8": 2, "9": 3, em1: 3, em2: 4, em3: 4 };
const esc = (t: string) => t.replace(/[\\%_]/g, "\\$&");

/** Monta a prova a partir de temas, série e disciplina: pesquisa no banco, escolhe e abre direto no editor. */
export async function montarProvaAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const p = z.object({
    title: z.string().trim().max(140).optional(),
    classId: z.string().optional(),
    grade: z.string().min(1, "Escolha a série."),
    subject: z.string().min(1, "Escolha a disciplina."),
    themes: z.string().trim().min(2, "Escreva ao menos um tema (ex.: Machado de Assis, funções, Revolução Francesa)."),
    count: z.coerce.number().int().min(1).max(60),
    dificuldade: z.coerce.number().int().min(0).max(5).optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const classId = p.data.classId || null;
  if (classId) await loadClass(ctx, classId);
  const insts = fd.getAll("inst").map(String).filter(Boolean);
  const temas = p.data.themes.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean).slice(0, 8);
  const alvo = p.data.dificuldade || DIFICULDADE_POR_SERIE[p.data.grade] || 3;

  // 1) termos de busca: temas + conhecimento de autores/assuntos + expansão pela IA (se houver)
  const parsed = temas.map((t) => parseQuery(t));
  let extra: string[] = [];
  if (aiAvailable()) { try { extra = (await aiExpandThemes({ themes: temas, subject: subjectLabel(p.data.subject), grade: gradeLabel(p.data.grade) })).map(norm).filter((t) => t.length > 2); } catch { /* segue sem IA */ } }
  const termos = [...new Set([...parsed.flatMap((x) => [...x.entities.flatMap((e) => [...e.namesN, ...e.relatedN]), ...x.tokens]), ...extra])].filter((t) => t.length > 1).slice(0, 80);
  if (!termos.length) return { error: "Não entendi os temas. Tente palavras como “porcentagem” ou “Machado de Assis”." };

  // 2) candidatos no SQL (índice trigram), só questões liberadas e com gabarito
  const cond = [
    eq(questions.status, "released"), isNotNull(questions.answer), isNotNull(questions.statement), eq(questions.voided, false),
    or(isNull(questions.ownerOrgId), eq(questions.ownerOrgId, ctx.org.id)),
    p.data.subject === "todas" ? undefined : inArray(questions.subject, p.data.subject === "lingua-portuguesa" || p.data.subject === "literatura" ? ["lingua-portuguesa", "literatura"] : [p.data.subject]),
    insts.length ? or(...insts.map((i) => eq(questions.institution, i))) : undefined,
    or(...termos.map((t) => ilike(questions.searchNorm, `%${esc(t)}%`))),
  ].filter(Boolean);
  const pool = await db.select().from(questions).where(and(...cond)).orderBy(desc(questions.year)).limit(1500);
  const used = new Set(await usedQuestionIdsForClass(classId));

  // 3) pontuação por tema; escolha alternada entre temas para cobrir todos
  const scored = pool.filter((q) => q.alternatives.length >= 2).map((q) => {
    const doc = { title: q.title, statement: q.statement, alternatives: q.alternatives, institution: q.institution, exam: q.exam, year: q.year };
    const porTema = parsed.map((x) => scoreDoc(doc, x).score);
    const norma = q.searchNorm ?? "";
    const aiHits = extra.filter((t) => norma.includes(t)).length;
    const fit = -Math.abs(q.difficulty - alvo) * 0.5 - (used.has(q.id) ? 6 : 0);
    return { q, porTema, base: Math.max(0, ...porTema) + aiHits * 1.5 + fit };
  }).filter((s) => s.base > 0 && (Math.max(...s.porTema) > 0 || extra.length > 0));
  scored.sort((a, b) => b.base - a.base);
  const picked: typeof scored = [];
  const taken = new Set<string>(); const stims = new Set<string>();
  const queues = temas.map((_, i) => [...scored].sort((a, b) => b.porTema[i] - a.porTema[i]).filter((s) => s.porTema[i] > 0));
  for (let r = 0; picked.length < p.data.count && r < p.data.count * 2; r++) {
    for (let i = 0; i < queues.length && picked.length < p.data.count; i++) {
      const s = queues[i].find((x) => !taken.has(x.q.id) && !(x.q.stimulusId && stims.has(x.q.stimulusId)));
      if (s) { taken.add(s.q.id); if (s.q.stimulusId) stims.add(s.q.stimulusId); picked.push(s); }
    }
    if (!queues.some((qu) => qu.some((x) => !taken.has(x.q.id)))) break;
  }
  for (const s of scored) { if (picked.length >= p.data.count) break; if (!taken.has(s.q.id)) { taken.add(s.q.id); picked.push(s); } }
  if (!picked.length) return { error: "Não encontrei questões liberadas para esses temas. Tente outros termos, mude a disciplina para “Todas” ou remova o filtro de bancas." };

  // 4) cria a prova, cobra a cota e abre no editor
  const title = p.data.title || `Prova de ${subjectLabel(p.data.subject === "todas" ? "interdisciplinar" : p.data.subject)} — ${temas.slice(0, 2).join(", ")}`;
  const [a] = await db.insert(assessments).values({
    orgId: ctx.org.id, classId, ownerId: ctx.user.id, title, scope: { willFall: [], prerequisite: [], notTaught: [], confirm: [], sources: {} },
    wantedCount: p.data.count, durationMin: Math.max(10, picked.length * 4), totalPoints: "10", filters: { institutions: insts, difficulty: [] },
  }).returning();
  const cota = await consumeAssembly(ctx.org.id, a.id);
  if (!cota.ok) { await db.delete(assessments).where(eq(assessments.id, a.id)); return { error: `${cota.reason} Você ainda pode montar manualmente pelo Banco de questões.` }; }
  const pts = evenPoints(10, picked.length);
  await db.insert(assessmentItems).values(picked.map((s, i) => {
    const hit = temas.find((_, k) => s.porTema[k] > 0);
    return { assessmentId: a.id, questionId: s.q.id, position: i + 1, points: String(pts[i]), reason: `${hit ? `Tema “${hit}”. ` : "Relacionada aos temas pedidos. "}${s.q.institution} ${s.q.year}.` };
  }));
  await audit(ctx.user.id, ctx.org.id, "assessment.composed", a.id, { temas, found: picked.length });
  await track("search_done", ctx.user.id, ctx.org.id, { found: picked.length, wanted: p.data.count });
  redirect(`/app/provas/${a.id}/editar?novo=${picked.length}-${p.data.count}`);
}
