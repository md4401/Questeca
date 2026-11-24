import "server-only";
import { and, eq, or, ilike, isNull, isNotNull, inArray, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { aiAvailable, aiExpandThemes, aiEscolherQuestoes, aiGerarQuestoes, type QuestaoGerada } from "@/lib/ai";
import { SemCreditos } from "@/lib/credits";
import { searchNormOf } from "@/lib/core/search";
import { parseQuery, scoreDoc, norm, variantes } from "@/lib/core/search";
import { subjectLabel, gradeLabel } from "@/lib/taxonomy";
import { assessments, assessmentItems } from "@/db/schema";
import { loadClass } from "@/lib/access";
import { evenPoints, usedQuestionIdsForClass } from "@/lib/assessments";
import { consumeAssembly } from "@/lib/billing";
import { audit, track } from "@/lib/audit";
import type { Ctx } from "@/lib/session";

/** Dificuldade-alvo (1 a 5) pela série. As questões do banco têm dificuldade 3 por padrão, então é só uma preferência. */
export const DIFICULDADE_POR_SERIE: Record<string, number> = { "6": 1, "7": 2, "8": 2, "9": 3, em1: 3, em2: 4, em3: 4 };
const esc = (t: string) => t.replace(/[\\%_]/g, "\\$&");

/** Pesquisa no banco por temas e escolhe as melhores questões liberadas, alternando entre os temas. */
export async function selecionarPorTemas(i: { orgId: string; temas: string[]; subject: string; grade: string; count: number; insts: string[]; dificuldade?: number; usedIds: string[] }) {
  const { temas } = i;
  const alvo = i.dificuldade || DIFICULDADE_POR_SERIE[i.grade] || 3;
  const p = { data: { subject: i.subject, grade: i.grade, count: i.count } };
  const insts = i.insts; const ctx = { org: { id: i.orgId } };
  const used = new Set(i.usedIds);
  // 1) termos de busca: temas + conhecimento de autores/assuntos + expansão pela IA (se houver)
  const parsed = temas.map((t) => parseQuery(t));
  let extra: string[] = [];
  if (aiAvailable()) { try { extra = (await aiExpandThemes({ themes: temas, subject: subjectLabel(p.data.subject), grade: gradeLabel(p.data.grade) })).map(norm).filter((t) => t.length > 2); } catch { /* segue sem IA */ } }
  const termos = [...new Set([...parsed.flatMap((x) => [...x.entities.flatMap((e) => [...e.namesN, ...e.relatedN]), ...x.tokens.flatMap(variantes)]), ...extra])].filter((t) => t.length > 1).slice(0, 80);
  if (!termos.length) return { picked: [] as never[], candidatos: [] as never[], temas, termos: 0 };

  // 2) candidatos no SQL (índice trigram), só questões liberadas e com gabarito
  const cond = [
    eq(questions.status, "released"), isNotNull(questions.answer), isNotNull(questions.statement), eq(questions.voided, false),
    or(isNull(questions.ownerOrgId), eq(questions.ownerOrgId, ctx.org.id)),
    p.data.subject === "todas" ? undefined : inArray(questions.subject, p.data.subject === "lingua-portuguesa" || p.data.subject === "literatura" ? ["lingua-portuguesa", "literatura"] : [p.data.subject]),
    insts.length ? or(...insts.map((i) => eq(questions.institution, i))) : undefined,
    or(...termos.map((t) => ilike(questions.searchNorm, `%${esc(t)}%`))),
  ].filter(Boolean);
  // as candidatas mais relevantes (mais termos batendo) vêm primeiro; o ano só desempata. Assim o corte de 1.500 nunca joga fora as melhores.
  const hits = sql<number>`(${sql.join(termos.slice(0, 30).map((t) => sql`(${questions.searchNorm} ILIKE ${`%${esc(t)}%`})::int`), sql` + `)})`;
  const pool = await db.select().from(questions).where(and(...cond)).orderBy(desc(hits), desc(questions.year)).limit(1500);

  // 3) pontuação por tema; escolha alternada entre temas para cobrir todos
  const scored = pool.filter((q) => q.alternatives.length >= 2).map((q) => {
    const doc = { title: q.title, statement: q.statement, alternatives: q.alternatives, institution: q.institution, exam: q.exam, year: q.year };
    const porTema = parsed.map((x) => scoreDoc(doc, x).score);
    const norma = q.searchNorm ?? "";
    const aiHits = extra.filter((t) => norma.includes(t)).length;
    const fit = -Math.abs(q.difficulty - alvo) * 0.3 + (q.series.length ? (q.series.includes(i.grade) ? 2 : -2) : 0) - (used.has(q.id) ? 6 : 0);
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

  return { picked, candidatos: scored.slice(0, 30), temas, termos: termos.length };
}

/** A GizIA cria questões inéditas e as guarda (só para a escola do professor, marcadas como "ia"). Exige a permissão do professor. */
export async function gerarQuestoesIA(ctx: Ctx, i: { temas: string[]; subject: string; grade: string; n: number }): Promise<{ geradas: { id: string; tema: string }[]; aviso?: string; negado?: string }> {
  if (!aiAvailable()) return { geradas: [], negado: "A GizIA ainda não está ativada nesta instalação (falta a chave de IA)." };
  if (!ctx.user.prefs?.gizCriaQuestoes) return { geradas: [], negado: "A criação de questões pela GizIA está desligada. Ative em Minha conta › Perfil e preferências (“Permitir que a GizIA crie questões novas”)." };
  const geradas: { id: string; tema: string }[] = []; let aviso: string | undefined;
  try {
    const serieRot = gradeLabel(i.grade); const disc = subjectLabel(i.subject === "todas" ? "interdisciplinar" : i.subject);
    const novas: QuestaoGerada[] = [];
    for (let k = 0; k < i.n && novas.length < i.n; k += 8) novas.push(...(await aiGerarQuestoes({ temas: i.temas, disciplina: disc, serie: serieRot, n: Math.min(8, i.n - k) })));
    const ano = new Date().getFullYear();
    for (const q of novas.slice(0, i.n)) {
      const alternatives = q.alternativas.map((t, n) => ({ key: "ABCDE"[n], text: t }));
      const [row] = await db.insert(questions).values({
        institution: "GizIA", exam: "Questão criada pela GizIA", year: ano, subject: i.subject === "todas" ? "interdisciplinar" : i.subject, tema: q.tema, series: [i.grade], origin: "ia", ownerOrgId: ctx.org.id,
        title: q.enunciado.replace(/\s+/g, " ").slice(0, 100), statement: q.enunciado, alternatives, answer: q.gabarito, answerSource: "Gerada pela GizIA — confira o gabarito", status: "released",
        licenseNote: "Questão criada pela GizIA a pedido do professor; visível só para a escola. Confira enunciado e gabarito.",
        searchNorm: searchNormOf({ title: q.enunciado.slice(0, 100), statement: q.enunciado, alternatives, institution: "GizIA", exam: "Questão criada pela GizIA", year: ano, extra: q.tema }),
      }).returning({ id: questions.id });
      geradas.push({ id: row.id, tema: q.tema });
    }
    if (geradas.length < i.n) aviso = `A GizIA criou ${geradas.length} de ${i.n} questões; complete com “+ Questão nova” ou “+ Questão do banco”.`;
  } catch (e) { aviso = e instanceof SemCreditos ? "Seus créditos de IA acabaram antes de criar as questões novas." : "Não consegui criar as questões com a GizIA agora."; }
  return { geradas, aviso };
}

export type ModoIA = "banco" | "completar" | "novas";

/** Cria o rascunho da prova a partir dos temas (formulário "Montar prova" e assistente). A IA, quando disponível, escolhe as melhores questões do banco e, se o professor habilitar, cria questões novas. */
export async function criarProvaPorTemas(ctx: Ctx, i: { title?: string; classId?: string | null; grade: string; subject: string; temas: string[]; count: number; insts?: string[]; dificuldade?: number; ia?: ModoIA }): Promise<{ ok: true; id: string; found: number; wanted: number; geradas: number; escolhidaPorIA: boolean; aviso?: string } | { ok: false; error: string }> {
  const classId = i.classId || null;
  if (classId) await loadClass(ctx, classId);
  const temas = i.temas.map((t) => t.trim()).filter(Boolean).slice(0, 8);
  const insts = i.insts ?? [];
  const modo: ModoIA = i.ia ?? "banco";
  if (modo !== "banco" && !aiAvailable()) return { ok: false, error: "Criar questões com IA precisa da GizIA ativada nesta instalação (chave de IA)." };
  if (modo !== "banco" && !ctx.user.prefs?.gizCriaQuestoes) return { ok: false, error: "A criação de questões pela GizIA está desligada. Ative em Minha conta › Perfil e preferências (“Permitir que a GizIA crie questões novas”) e tente de novo." };
  const r = modo === "novas" ? { picked: [] as Awaited<ReturnType<typeof selecionarPorTemas>>["picked"], candidatos: [] as Awaited<ReturnType<typeof selecionarPorTemas>>["candidatos"], termos: temas.length }
    : await selecionarPorTemas({ orgId: ctx.org.id, temas, subject: i.subject, grade: i.grade, count: i.count, insts, dificuldade: i.dificuldade, usedIds: await usedQuestionIdsForClass(classId) });
  if (!r.termos) return { ok: false, error: "Não entendi os temas. Tente palavras como “porcentagem” ou “Machado de Assis”." };
  let picked = r.picked; let aviso: string | undefined; let escolhidaPorIA = false;

  // A IA escolhe as melhores entre as candidatas já filtradas (tema, série e relevância)
  if (modo !== "novas" && aiAvailable() && r.candidatos.length > Math.min(i.count, picked.length)) {
    try {
      const ids = await aiEscolherQuestoes({ temas, disciplina: subjectLabel(i.subject === "todas" ? "interdisciplinar" : i.subject), serie: gradeLabel(i.grade), n: i.count, candidatas: r.candidatos.map((c) => ({ id: c.q.id, tema: c.q.tema, series: c.q.series, banca: c.q.institution, ano: c.q.year, trecho: (c.q.statement ?? "").replace(/\s+/g, " ").slice(0, 170) })) });
      const porId = new Map(r.candidatos.map((c) => [c.q.id.slice(0, 8), c]));
      const escolhidas = [...new Set(ids)].map((x) => porId.get(x)).filter((x): x is NonNullable<typeof x> => !!x).slice(0, i.count);
      if (escolhidas.length) {
        const tem = new Set(escolhidas.map((e) => e.q.id));
        picked = [...escolhidas, ...picked.filter((p) => !tem.has(p.q.id))].slice(0, i.count);
        escolhidaPorIA = true;
      }
    } catch (e) { if (e instanceof SemCreditos) aviso = "Seus créditos de IA acabaram: as questões foram escolhidas pelo critério automático."; }
  }

  // Criação de questões novas com IA (só quando o professor habilita)
  const faltam = modo === "novas" ? Math.min(i.count, 15) : modo === "completar" ? Math.max(0, i.count - picked.length) : 0;
  let geradas: { id: string; tema: string }[] = [];
  if (faltam > 0) { const g = await gerarQuestoesIA(ctx, { temas, subject: i.subject, grade: i.grade, n: faltam }); geradas = g.geradas; aviso = g.aviso ?? aviso; }
  if (!picked.length && !geradas.length) return { ok: false, error: aviso ?? "Não encontrei questões liberadas para esses temas. Tente outros termos, mude a disciplina para “Todas”, remova o filtro de bancas ou habilite “Criar com IA”." };

  const total = picked.length + geradas.length;
  const title = i.title || `Prova de ${subjectLabel(i.subject === "todas" ? "interdisciplinar" : i.subject)} — ${temas.slice(0, 2).join(", ")}`;
  const [a] = await db.insert(assessments).values({
    orgId: ctx.org.id, classId, ownerId: ctx.user.id, title, scope: { willFall: [...new Set(picked.flatMap((s) => [...s.q.assessed, ...s.q.prerequisites]))], prerequisite: [], notTaught: [], confirm: [], sources: {} },
    wantedCount: i.count, durationMin: Math.max(10, total * 4), totalPoints: "10", filters: { institutions: insts, difficulty: [] },
  }).returning();
  const cota = await consumeAssembly(ctx.org.id, a.id);
  if (!cota.ok) { await db.delete(assessments).where(eq(assessments.id, a.id)); return { ok: false, error: `${cota.reason} Você ainda pode montar manualmente pelo Banco de questões.` }; }
  const pts = evenPoints(10, total);
  await db.insert(assessmentItems).values([
    ...picked.map((s, k) => {
      const hit = temas.find((_, n) => s.porTema[n] > 0);
      return { assessmentId: a.id, questionId: s.q.id, position: k + 1, points: String(pts[k]), reason: `${escolhidaPorIA ? "Escolhida pela GizIA" : "Escolhida"}${s.q.tema ? ` · ${s.q.tema}` : ""}${hit ? ` · tema “${hit}”` : ""}. ${s.q.institution} ${s.q.year}.` };
    }),
    ...geradas.map((g, k) => ({ assessmentId: a.id, questionId: g.id, position: picked.length + k + 1, points: String(pts[picked.length + k]), reason: `Criada pela GizIA · ${g.tema}. Confira enunciado e gabarito.` })),
  ]);
  await audit(ctx.user.id, ctx.org.id, "assessment.composed", a.id, { temas, found: picked.length, geradas: geradas.length, ia: escolhidaPorIA });
  await track("search_done", ctx.user.id, ctx.org.id, { found: picked.length, wanted: i.count });
  return { ok: true, id: a.id, found: total, wanted: i.count, geradas: geradas.length, escolhidaPorIA, aviso };
}
