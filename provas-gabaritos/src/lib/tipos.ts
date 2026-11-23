import { z } from "zod";

/** Só http(s): nunca javascript:, data: etc. */
const urlSegura = z.string().url().refine((u) => /^https?:\/\//i.test(u), "A URL deve começar com http:// ou https://");
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD");
export const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens");

export const TIPOS_ARQUIVO = ["prova", "gabarito", "caderno", "comentada", "edital", "outro"] as const;
export const TIPO_ROTULO: Record<(typeof TIPOS_ARQUIVO)[number], string> = { prova: "Prova", gabarito: "Gabarito", caderno: "Caderno de questões", comentada: "Resolução comentada", edital: "Edital / manual", outro: "Outro arquivo" };

export const ArquivoSchema = z.object({
  tipo: z.enum(TIPOS_ARQUIVO),
  /** Texto do botão, ex.: "Prova — 1ª fase", "Gabarito oficial". */
  rotulo: z.string().min(2).max(120),
  url: urlSegura,
  formato: z.enum(["pdf", "zip", "html", "docx", "outro"]).default("pdf"),
  /** Caderno, cor ou variante (ex.: "Caderno 1 azul", "ampliada", "Libras"). */
  versao: z.string().max(80).optional(),
  /** "oficial" (padrão) ou "secundaria": fonte que não é a instituição; sempre sinalizada no site. */
  origem: z.enum(["oficial", "secundaria"]).optional(),
});

export const EdicaoSchema = z.object({
  id: slug,
  instituicao: slug,
  ano: z.number().int().min(1900).max(2100),
  /** Ex.: "Vestibular 2024 · 1ª fase", "ENEM 2019 · 1º dia". */
  nome: z.string().min(3).max(140),
  /** "1ª fase", "2ª fase", "Fase única"… */
  fase: z.string().max(40).optional(),
  /** "1º dia", "2º dia"… */
  dia: z.string().max(40).optional(),
  /** Aplicação: "Regular", "Reaplicação (PPL)", "Digital"… */
  aplicacao: z.string().max(60).optional(),
  arquivos: z.array(ArquivoSchema).min(1),
  /** Página oficial em que a edição está listada (de onde os links foram tirados). */
  fonte: urlSegura,
  observacao: z.string().max(400).optional(),
});

export const CATEGORIAS = ["exame-nacional", "vestibular", "militar", "faculdade-privada"] as const;
export const CATEGORIA_ROTULO: Record<(typeof CATEGORIAS)[number], string> = { "exame-nacional": "Exame nacional", vestibular: "Vestibular", militar: "Concurso militar", "faculdade-privada": "Faculdade privada" };

export const InstituicaoSchema = z.object({
  slug,
  nome: z.string().min(3),
  sigla: z.string().min(2).max(24),
  categoria: z.enum(CATEGORIAS),
  descricao: z.string().min(10).max(300),
  /** Endereço oficial confirmado; null quando ainda não foi confirmado. */
  site: urlSegura.nullable(),
  /** Página oficial que lista as provas anteriores (quando conhecida). */
  paginaProvas: urlSegura.nullable(),
  primeiraEdicao: z.number().int().min(1900).max(2100).nullable(),
  observacao: z.string().max(300).optional(),
});

export const VerificacaoSchema = z.record(z.string(), z.object({
  status: z.enum(["ok", "quebrado", "desconhecido"]),
  httpStatus: z.number().int().nullable(),
  contentType: z.string().nullable(),
  verificadoEm: dia,
}));

export type Arquivo = z.infer<typeof ArquivoSchema>;
export type Edicao = z.infer<typeof EdicaoSchema>;
export type Instituicao = z.infer<typeof InstituicaoSchema>;
export type Verificacao = z.infer<typeof VerificacaoSchema>;
