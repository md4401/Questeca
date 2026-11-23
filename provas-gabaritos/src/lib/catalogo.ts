import { EDICOES_BRUTAS, INSTITUICOES_BRUTAS, VERIFICACAO_BRUTA } from "@/lib/dados";
import { validarCatalogo } from "@/lib/validacao";
import type { Arquivo, Edicao, Instituicao } from "@/lib/tipos";

const r = validarCatalogo({ instituicoes: INSTITUICOES_BRUTAS, edicoes: EDICOES_BRUTAS, verificacao: VERIFICACAO_BRUTA });
if (r.erros.length) throw new Error("Catálogo inválido:\n" + r.erros.join("\n"));

export const instituicoes: Instituicao[] = r.instituicoes;
export const edicoes: Edicao[] = [...r.edicoes].sort((a, b) => b.ano - a.ano || a.nome.localeCompare(b.nome, "pt-BR"));
export const verificacao = r.verificacao;

export const instituicao = (slug: string) => instituicoes.find((i) => i.slug === slug) ?? null;
export const edicoesDe = (slug: string) => edicoes.filter((e) => e.instituicao === slug);
export const edicao = (id: string) => edicoes.find((e) => e.id === id) ?? null;

export type StatusLink = "ok" | "quebrado" | "desconhecido";
export const statusDe = (a: Arquivo): { status: StatusLink; em?: string } => { const v = verificacao[a.url]; return v ? { status: v.status, em: v.verificadoEm } : { status: "desconhecido" }; };

export function resumo(slug: string) {
  const es = edicoesDe(slug);
  const anos = es.map((e) => e.ano);
  return { edicoes: es.length, arquivos: es.reduce((n, e) => n + e.arquivos.length, 0), de: anos.length ? Math.min(...anos) : null, ate: anos.length ? Math.max(...anos) : null };
}
export const totais = () => ({ instituicoes: instituicoes.length, edicoes: edicoes.length, arquivos: edicoes.reduce((n, e) => n + e.arquivos.length, 0) });

/** Edição com o status de cada link já resolvido (para componentes de cliente). */
export function comStatus(e: Edicao) { return { ...e, _s: Object.fromEntries(e.arquivos.map((a, i) => [i, statusDe(a)])) as Record<number, { status: string; em?: string }> }; }
