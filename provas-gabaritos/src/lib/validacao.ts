import { z } from "zod";
import { EdicaoSchema, InstituicaoSchema, VerificacaoSchema, type Edicao, type Instituicao, type Verificacao } from "@/lib/tipos";

export type Resultado = { instituicoes: Instituicao[]; edicoes: Edicao[]; verificacao: Verificacao; erros: string[]; avisos: string[] };

/** Valida todo o catálogo. Erros impedem o build; avisos são só informativos. */
export function validarCatalogo(brutas: { instituicoes: unknown; edicoes: Record<string, unknown>; verificacao: unknown }): Resultado {
  const erros: string[] = []; const avisos: string[] = [];
  const insts = z.array(InstituicaoSchema).safeParse(brutas.instituicoes);
  const instituicoes = insts.success ? insts.data : [];
  if (!insts.success) for (const i of insts.error.issues) erros.push(`instituicoes.json › ${i.path.join(".")}: ${i.message}`);
  const slugs = new Set<string>();
  for (const i of instituicoes) { if (slugs.has(i.slug)) erros.push(`Instituição duplicada: ${i.slug}`); slugs.add(i.slug); }
  for (const k of Object.keys(brutas.edicoes)) if (!slugs.has(k)) erros.push(`Há um arquivo de edições para "${k}", que não está em instituicoes.json`);
  const edicoes: Edicao[] = []; const ids = new Set<string>(); const urls = new Map<string, string>();
  for (const i of instituicoes) {
    const raw = brutas.edicoes[i.slug];
    if (raw === undefined) { avisos.push(`${i.slug}: sem arquivo de edições`); continue; }
    const p = z.array(EdicaoSchema).safeParse(raw);
    if (!p.success) { for (const e of p.error.issues) erros.push(`edicoes/${i.slug}.json › ${e.path.join(".")}: ${e.message}`); continue; }
    for (const e of p.data) {
      if (e.instituicao !== i.slug) erros.push(`${e.id}: instituicao "${e.instituicao}" não bate com o arquivo ${i.slug}.json`);
      if (ids.has(e.id)) erros.push(`ID de edição duplicado: ${e.id}`); ids.add(e.id);
      if (!e.id.startsWith(`${i.slug}-`)) avisos.push(`${e.id}: prefixe o id com "${i.slug}-"`);
      if (i.primeiraEdicao && e.ano < i.primeiraEdicao) erros.push(`${e.id}: ano ${e.ano} é anterior à primeira edição (${i.primeiraEdicao})`);
      for (const a of e.arquivos) {
        const antes = urls.get(a.url); if (antes) avisos.push(`URL repetida em ${e.id} e ${antes}: ${a.url}`); urls.set(a.url, e.id);
        if (a.url.startsWith("http://")) avisos.push(`${e.id}: link sem HTTPS (${a.url})`);
      }
      if (!e.arquivos.some((a) => a.tipo === "gabarito")) avisos.push(`${e.id}: sem gabarito`);
      edicoes.push(e);
    }
  }
  const v = VerificacaoSchema.safeParse(brutas.verificacao);
  if (!v.success) for (const e of v.error.issues) erros.push(`verificacao.json › ${e.path.join(".")}: ${e.message}`);
  return { instituicoes, edicoes, verificacao: v.success ? v.data : {}, erros, avisos };
}
