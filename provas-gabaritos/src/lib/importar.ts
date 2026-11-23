import type { Edicao } from "@/lib/tipos";

/** Lê CSV simples (vírgula ou ponto e vírgula, aspas duplas, quebras de linha dentro de aspas). */
export function lerCsv(texto: string): Record<string, string>[] {
  const sep = (texto.split("\n", 1)[0].match(/;/g)?.length ?? 0) > (texto.split("\n", 1)[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = []; let cel = ""; let lin: string[] = []; let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) { if (c === '"') { if (texto[i + 1] === '"') { cel += '"'; i++; } else aspas = false; } else cel += c; }
    else if (c === '"') aspas = true;
    else if (c === sep) { lin.push(cel); cel = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && texto[i + 1] === "\n") i++; lin.push(cel); cel = ""; if (lin.some((x) => x.trim())) linhas.push(lin); lin = []; }
    else cel += c;
  }
  lin.push(cel); if (lin.some((x) => x.trim())) linhas.push(lin);
  const [cab, ...resto] = linhas;
  if (!cab) return [];
  const chaves = cab.map((h) => h.trim().toLowerCase());
  return resto.map((l) => Object.fromEntries(chaves.map((k, i) => [k, (l[i] ?? "").trim()])));
}

export const idDe = (inst: string, ano: number, nome: string) => `${inst}-${ano}-${nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(new RegExp(`^${inst}-?`), "").replace(new RegExp(`^${ano}-?`), "")}`.replace(/-+$/g, "");

/**
 * Colunas: instituicao, ano, nome, tipo, rotulo, url, fonte; opcionais: formato, fase, dia, aplicacao, versao, origem, observacao.
 * Linhas com a mesma instituição + ano + nome viram uma única edição com vários arquivos.
 */
export function agruparCsv(linhas: Record<string, string>[]): { edicoes: Edicao[]; erros: string[] } {
  const erros: string[] = []; const mapa = new Map<string, Edicao>();
  linhas.forEach((l, n) => {
    const quando = `linha ${n + 2}`;
    const ano = Number(l.ano);
    if (!l.instituicao || !Number.isInteger(ano) || !l.nome || !l.url || !l.tipo || !l.fonte) { erros.push(`${quando}: faltam colunas obrigatórias (instituicao, ano, nome, tipo, url, fonte)`); return; }
    const chave = `${l.instituicao}|${ano}|${l.nome}`;
    let e = mapa.get(chave);
    if (!e) { e = { id: idDe(l.instituicao, ano, l.nome), instituicao: l.instituicao, ano, nome: l.nome, arquivos: [], fonte: l.fonte, ...(l.fase ? { fase: l.fase } : {}), ...(l.dia ? { dia: l.dia } : {}), ...(l.aplicacao ? { aplicacao: l.aplicacao } : {}), ...(l.observacao ? { observacao: l.observacao } : {}) }; mapa.set(chave, e); }
    if (l.observacao && !e.observacao) e.observacao = l.observacao;
    if (e.arquivos.some((a) => a.url === l.url)) return;
    e.arquivos.push({ tipo: l.tipo as Edicao["arquivos"][number]["tipo"], rotulo: l.rotulo || l.tipo, url: l.url, formato: (l.formato || "pdf") as Edicao["arquivos"][number]["formato"], ...(l.versao ? { versao: l.versao } : {}), ...(l.origem === "secundaria" ? { origem: "secundaria" as const } : {}) });
  });
  return { edicoes: [...mapa.values()], erros };
}

/** Junta edições novas às existentes: mesma id → acrescenta arquivos com URL nova; id nova → inclui. */
export function mesclar(atuais: Edicao[], novas: Edicao[]): Edicao[] {
  const m = new Map(atuais.map((e) => [e.id, { ...e, arquivos: [...e.arquivos] }]));
  for (const n of novas) {
    const e = m.get(n.id);
    if (!e) { m.set(n.id, n); continue; }
    for (const a of n.arquivos) if (!e.arquivos.some((x) => x.url === a.url)) e.arquivos.push(a);
  }
  return [...m.values()].sort((a, b) => b.ano - a.ano || a.nome.localeCompare(b.nome, "pt-BR"));
}
