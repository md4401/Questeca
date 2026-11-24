import "server-only";
import { and, eq, or, ilike, isNull, isNotNull, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { aiAvailable, aiExpandThemes } from "@/lib/ai";
import { parseQuery, scoreDoc, norm } from "@/lib/core/search";
import { subjectLabel, gradeLabel } from "@/lib/taxonomy";

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
  const termos = [...new Set([...parsed.flatMap((x) => [...x.entities.flatMap((e) => [...e.namesN, ...e.relatedN]), ...x.tokens]), ...extra])].filter((t) => t.length > 1).slice(0, 80);
  if (!termos.length) return { picked: [] as never[], temas, termos: 0 };

  // 2) candidatos no SQL (índice trigram), só questões liberadas e com gabarito
  const cond = [
    eq(questions.status, "released"), isNotNull(questions.answer), isNotNull(questions.statement), eq(questions.voided, false),
    or(isNull(questions.ownerOrgId), eq(questions.ownerOrgId, ctx.org.id)),
    p.data.subject === "todas" ? undefined : inArray(questions.subject, p.data.subject === "lingua-portuguesa" || p.data.subject === "literatura" ? ["lingua-portuguesa", "literatura"] : [p.data.subject]),
    insts.length ? or(...insts.map((i) => eq(questions.institution, i))) : undefined,
    or(...termos.map((t) => ilike(questions.searchNorm, `%${esc(t)}%`))),
  ].filter(Boolean);
  const pool = await db.select().from(questions).where(and(...cond)).orderBy(desc(questions.year)).limit(1500);

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

  return { picked, temas, termos: termos.length };
}
