import type { Edicao, Instituicao } from "@/lib/tipos";

export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export type Filtro = { q?: string; instituicao?: string; de?: number; ate?: number; tipo?: string };

/** Busca por palavras (todas precisam aparecer no nome, na sigla ou no ano), sem acento nem caixa. */
export function buscar(edicoes: Edicao[], insts: Instituicao[], f: Filtro): Edicao[] {
  const termos = normalizar(f.q ?? "").split(" ").filter(Boolean);
  const porSlug = new Map(insts.map((i) => [i.slug, i]));
  return edicoes.filter((e) => {
    if (f.instituicao && e.instituicao !== f.instituicao) return false;
    if (f.de && e.ano < f.de) return false;
    if (f.ate && e.ano > f.ate) return false;
    if (f.tipo && !e.arquivos.some((a) => a.tipo === f.tipo)) return false;
    if (!termos.length) return true;
    const i = porSlug.get(e.instituicao);
    const alvo = normalizar(`${e.nome} ${e.ano} ${i?.sigla ?? ""} ${i?.nome ?? ""} ${e.arquivos.map((a) => a.rotulo).join(" ")}`);
    return termos.every((t) => alvo.includes(t));
  });
}

export const agruparPorAno = (lista: Edicao[]) => {
  const m = new Map<number, Edicao[]>();
  for (const e of lista) (m.get(e.ano) ?? m.set(e.ano, []).get(e.ano)!).push(e);
  return [...m].sort((a, b) => b[0] - a[0]);
};
