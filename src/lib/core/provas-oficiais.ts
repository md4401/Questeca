import { norm } from "@/lib/core/search";

export type Arquivo = { t: string; r: string; u: string; fm: string; v?: string; x?: 1 };
export type Edicao = { id: string; s: string; a: number; n: string; f?: string; d?: string; ap?: string; fo?: string; ar: Arquivo[] };
export type Instituicao = { slug: string; nome: string; sigla: string; aliases: string[]; site?: string | null; observacao?: string | null };
export type Catalogo = { instituicoes: Instituicao[]; edicoes: Edicao[] };

export const TIPOS: Record<string, string> = { prova: "Prova", gabarito: "Gabarito", caderno: "Caderno", comentada: "Comentada", edital: "Edital", outro: "Outro" };

/** Siglas e nomes populares → instituição (além dos aliases do catálogo). */
const EXTRA: Record<string, string> = { usp: "fuvest", unicamp: "comvest", unesp: "vunesp", inep: "enem", "pas": "pas-unb", unb: "pas-unb", puc: "puc-sp", pucsp: "puc-sp" };

export type Query = { q?: string; inst?: string; ano?: number; tipo?: string };
export type Result = { ed: Edicao; inst: Instituicao; arquivos: Arquivo[]; score: number };

export function searchCatalog(cat: Catalogo, query: Query): Result[] {
  const bySlug = new Map(cat.instituicoes.map((i) => [i.slug, i]));
  const tokens = norm(query.q ?? "").split(" ").filter(Boolean);
  const out: Result[] = [];
  for (const ed of cat.edicoes) {
    const inst = bySlug.get(ed.s); if (!inst) continue;
    if (query.inst && ed.s !== query.inst) continue;
    if (query.ano && ed.a !== query.ano) continue;
    const arquivos = query.tipo ? ed.ar.filter((a) => a.t === query.tipo) : ed.ar;
    if (query.tipo && !arquivos.length) continue;
    let score = 1;
    if (tokens.length) {
      const head = norm(`${inst.nome} ${inst.sigla} ${inst.aliases.join(" ")} ${ed.n} ${ed.a} ${ed.f ?? ""} ${ed.d ?? ""} ${ed.ap ?? ""}`);
      const files = norm(ed.ar.map((a) => `${a.r} ${a.v ?? ""}`).join(" "));
      score = 0;
      for (const t of tokens) {
        const alias = EXTRA[t];
        if (alias && ed.s === alias) { score += 6; continue; }
        if (/^\d{4}$/.test(t)) { if (ed.a === Number(t)) { score += 6; continue; } score = -1; break; }
        if (head.includes(t)) score += 4; else if (files.includes(t)) score += 2; else { score = -1; break; }
      }
      if (score <= 0) continue;
    }
    out.push({ ed, inst, arquivos, score });
  }
  return out.sort((a, b) => b.score - a.score || b.ed.a - a.ed.a || a.ed.n.localeCompare(b.ed.n, "pt-BR"));
}
