import type { Edicao, Instituicao } from "@/lib/tipos";

export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export type Filtro = {
  q?: string; instituicao?: string; de?: number; ate?: number; tipo?: string;
  /** Texto da fase (ex.: "2ª fase", "etapa 3", "exame discursivo"). */
  fase?: string; /** Texto do dia (ex.: "1º dia"). */ dia?: string;
  /** Trecho do nome de uma disciplina/área (procurado nos rótulos dos arquivos). */ disciplina?: string;
  ordem?: "recentes" | "antigos";
};

/** Texto pesquisável de uma edição: nome, ano, fase, dia, aplicação, instituição (sigla, nome, apelidos), rótulos, tipos e versões dos arquivos. */
export function textoDe(e: Edicao, i?: Instituicao): string {
  return normalizar(`${e.nome} ${e.ano} ${i?.sigla ?? ""} ${i?.nome ?? ""} ${(i?.aliases ?? []).join(" ")} ${i?.descricao ?? ""} ${e.fase ?? ""} ${e.dia ?? ""} ${e.aplicacao ?? ""} ${e.arquivos.map((a) => `${a.tipo} ${a.rotulo} ${a.versao ?? ""}`).join(" ")}`);
}

/** Busca por palavras (todas precisam aparecer), sem acento nem caixa; reconhece siglas e nomes alternativos da instituição. */
export function buscar(edicoes: Edicao[], insts: Instituicao[], f: Filtro): Edicao[] {
  const termos = normalizar(f.q ?? "").split(" ").filter(Boolean);
  const fase = normalizar(f.fase ?? ""), dia = normalizar(f.dia ?? ""), disc = normalizar(f.disciplina ?? "");
  const porSlug = new Map(insts.map((i) => [i.slug, i]));
  const r = edicoes.filter((e) => {
    if (f.instituicao && e.instituicao !== f.instituicao) return false;
    if (f.de && e.ano < f.de) return false;
    if (f.ate && e.ano > f.ate) return false;
    if (f.tipo && !e.arquivos.some((a) => a.tipo === f.tipo)) return false;
    if (fase && !normalizar(`${e.fase ?? ""} ${e.nome}`).includes(fase)) return false;
    if (dia && !normalizar(`${e.dia ?? ""} ${e.nome}`).includes(dia)) return false;
    if (disc && !e.arquivos.some((a) => normalizar(`${a.rotulo} ${a.versao ?? ""}`).includes(disc))) return false;
    if (!termos.length) return true;
    const alvo = textoDe(e, porSlug.get(e.instituicao));
    return termos.every((t) => alvo.includes(t));
  });
  const dir = f.ordem === "antigos" ? 1 : -1;
  return r.sort((a, b) => dir * (a.ano - b.ano) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Instituições cujo nome, sigla ou apelido contém todas as palavras (ex.: "unicamp" → COMVEST). */
export function buscarInstituicoes(insts: Instituicao[], q: string): Instituicao[] {
  const termos = normalizar(q).split(" ").filter(Boolean);
  if (!termos.length) return [];
  return insts.filter((i) => { const alvo = normalizar(`${i.sigla} ${i.nome} ${(i.aliases ?? []).join(" ")} ${i.slug}`); return termos.every((t) => alvo.includes(t)); });
}

export const agruparPorAno = (lista: Edicao[]) => {
  const m = new Map<number, Edicao[]>();
  for (const e of lista) (m.get(e.ano) ?? m.set(e.ano, []).get(e.ano)!).push(e);
  return [...m].sort((a, b) => b[0] - a[0]);
};

/** Valores distintos (fase ou dia) para montar os filtros, na ordem em que aparecem com mais frequência. */
export function valoresDistintos(edicoes: Edicao[], campo: "fase" | "dia" | "aplicacao"): string[] {
  const c = new Map<string, number>();
  for (const e of edicoes) { const v = (e[campo] ?? "").trim(); if (v) c.set(v, (c.get(v) ?? 0) + 1); }
  return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).map(([v]) => v);
}
