import type { Edicao, Instituicao } from "@/lib/tipos";

export type Situacao = "sem-documentos" | "parcial" | "ampla";
export const SITUACAO_ROTULO: Record<Situacao, string> = {
  "sem-documentos": "Sem documentos coletados",
  parcial: "Cobertura parcial",
  ampla: "Cobertura ampla, com lacunas",
};

export type Cobertura = {
  slug: string; sigla: string; nome: string;
  edicoes: number; arquivos: number;
  provas: number; gabaritos: number; outros: number;
  /** Anos que têm ao menos um arquivo (ordem crescente). Nunca inclui anos sem arquivos. */
  anos: number[];
  primeiro: number | null; ultimo: number | null;
  /** Anos com prova e sem nenhum gabarito (fora provas de habilidades/práticas, que não têm gabarito). */
  anosSemGabarito: number[];
  /** Anos com gabarito e sem prova. */
  anosSemProva: number[];
  verificados: number; quebrados: number; desconhecidos: number; naoVerificados: number;
  situacao: Situacao;
};

/** "1987–1990, 1992, 2000–2003": agrupa só anos consecutivos presentes na lista. */
export function faixas(anos: number[]): string {
  const a = [...new Set(anos)].sort((x, y) => x - y);
  const out: string[] = [];
  for (let i = 0; i < a.length; ) {
    let j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    out.push(j > i + 0 ? `${a[i]}–${a[j]}` : `${a[i]}`); i = j + 1;
  }
  return out.join(", ");
}

/** Anos entre o primeiro e o último que NÃO têm arquivos (para mostrar buracos, sem afirmar que existiu edição). */
export function buracos(anos: number[]): number[] {
  const a = [...new Set(anos)].sort((x, y) => x - y); const set = new Set(a); const out: number[] = [];
  if (!a.length) return out;
  for (let y = a[0]; y <= a[a.length - 1]; y++) if (!set.has(y)) out.push(y);
  return out;
}

type Verif = Record<string, { status: string }>;

export function coberturaDe(i: Instituicao, edicoes: Edicao[], verificacao: Verif): Cobertura {
  const es = edicoes.filter((e) => e.instituicao === i.slug);
  const arq = es.flatMap((e) => e.arquivos);
  const anos = [...new Set(es.map((e) => e.ano))].sort((a, b) => a - b);
  const tem = (ano: number, tipo: string) => es.some((e) => e.ano === ano && e.arquivos.some((a) => a.tipo === tipo));
  const habilidade = (e: Edicao) => /habilidade|pr[aá]tica/i.test(`${e.aplicacao ?? ""} ${e.nome}`);
  const anosSemGabarito = anos.filter((y) => es.some((e) => e.ano === y && !habilidade(e) && e.arquivos.some((a) => a.tipo === "prova")) && !tem(y, "gabarito"));
  const anosSemProva = anos.filter((y) => tem(y, "gabarito") && !tem(y, "prova"));
  let verificados = 0, quebrados = 0, desconhecidos = 0, naoVerificados = 0;
  for (const a of arq) { const v = verificacao[a.url]; if (!v) naoVerificados++; else if (v.status === "ok") verificados++; else if (v.status === "quebrado") quebrados++; else desconhecidos++; }
  const situacao: Situacao = arq.length === 0 ? "sem-documentos" : anos.length >= 10 ? "ampla" : "parcial";
  return {
    slug: i.slug, sigla: i.sigla, nome: i.nome, edicoes: es.length, arquivos: arq.length,
    provas: arq.filter((a) => a.tipo === "prova").length, gabaritos: arq.filter((a) => a.tipo === "gabarito").length,
    outros: arq.filter((a) => a.tipo !== "prova" && a.tipo !== "gabarito").length,
    anos, primeiro: anos[0] ?? null, ultimo: anos[anos.length - 1] ?? null, anosSemGabarito, anosSemProva,
    verificados, quebrados, desconhecidos, naoVerificados, situacao,
  };
}

export const coberturaGeral = (insts: Instituicao[], edicoes: Edicao[], verificacao: Verif) => insts.map((i) => coberturaDe(i, edicoes, verificacao));
