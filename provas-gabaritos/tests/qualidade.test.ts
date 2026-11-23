import { describe, it, expect } from "vitest";
import { validarCatalogo } from "@/lib/validacao";
import { buscar, buscarInstituicoes, valoresDistintos } from "@/lib/busca";
import { resolverDownload, linkDownload } from "@/lib/download";
import { coberturaDe, coberturaGeral, faixas, buracos } from "@/lib/cobertura";
import { EDICOES_BRUTAS, INSTITUICOES_BRUTAS, VERIFICACAO_BRUTA } from "@/lib/dados";

const r = validarCatalogo({ instituicoes: INSTITUICOES_BRUTAS, edicoes: EDICOES_BRUTAS, verificacao: VERIFICACAO_BRUTA });
const insts = r.instituicoes, eds = r.edicoes;
const arquivos = eds.flatMap((e) => e.arquivos.map((a, n) => ({ e, a, n })));

describe("integridade do catálogo publicado", () => {
  it("tem exatamente as 20 instituições, com slugs únicos e todas com apelidos de busca", () => {
    expect(insts).toHaveLength(20);
    expect(new Set(insts.map((i) => i.slug)).size).toBe(20);
    expect(insts.every((i) => (i.aliases?.length ?? 0) > 0)).toBe(true);
  });
  it("não tem ids de edição repetidos nem URLs repetidas, e nenhuma URL vazia ou fictícia", () => {
    expect(new Set(eds.map((e) => e.id)).size).toBe(eds.length);
    expect(new Set(arquivos.map((x) => x.a.url)).size).toBe(arquivos.length);
    for (const { a, e } of arquivos) {
      const u = new URL(a.url);                       // lança se vazia/inválida
      expect(["http:", "https:"]).toContain(u.protocol);
      expect(u.hostname).not.toMatch(/(^|\.)(exemplo|example|test|localhost)(\.|$)/i);
      expect(new URL(e.fonte).hostname).not.toMatch(/exemplo|example|localhost/i);
    }
  });
  it("todo arquivo tem rótulo, formato permitido e tipo coerente com o rótulo (gabarito/padrão/respostas ≠ prova)", () => {
    for (const { a, e } of arquivos) {
      expect(a.rotulo.length).toBeGreaterThan(0);
      expect(["pdf", "zip", "docx", "doc", "outro"]).toContain(a.formato);
      if (a.tipo === "prova") expect(a.rotulo).not.toMatch(/^(gabarito|padr[aã]o de resposta|respostas esperadas)/i);
      if (a.tipo === "gabarito") expect(a.rotulo).toMatch(/gabarito|padr[aã]o|respostas? esperadas?|expectativa|crit[eé]rios/i);
      expect(e.ano).toBeGreaterThan(1900);
    }
  });
  it("nenhuma edição fica sem arquivos e cada ano é plausível", () => {
    for (const e of eds) { expect(e.arquivos.length).toBeGreaterThan(0); expect(e.ano).toBeLessThanOrEqual(2100); }
  });
  it("nenhum link conhecido como quebrado deixa de ser sinalizado (status só ok/quebrado/desconhecido)", () => {
    for (const v of Object.values(VERIFICACAO_BRUTA as Record<string, { status: string }>)) expect(["ok", "quebrado", "desconhecido"]).toContain(v.status);
  });
});

describe("busca por siglas e nomes alternativos", () => {
  const achaInst = (q: string) => buscarInstituicoes(insts, q).map((i) => i.slug);
  it("UNICAMP encontra COMVEST; UNESP encontra VUNESP; PAS e UnB encontram o PAS/UnB; Mackenzie encontra a Universidade Presbiteriana", () => {
    expect(achaInst("unicamp")).toContain("comvest");
    expect(achaInst("Unesp")).toContain("vunesp");
    expect(achaInst("PAS")).toContain("pas-unb");
    expect(achaInst("UnB")).toContain("pas-unb");
    expect(achaInst("Universidade Presbiteriana Mackenzie")).toContain("mackenzie");
    expect(achaInst("USP")).toContain("fuvest");
    expect(achaInst("Albert Einstein")).toContain("einstein");
    expect(achaInst("fgv")).toContain("fgv");
  });
  it("a busca de edições também usa os apelidos (sem acento nem caixa)", () => {
    expect(buscar(eds, insts, { q: "UNICAMP 2023" }).every((e) => e.instituicao === "comvest")).toBe(true);
    expect(buscar(eds, insts, { q: "unicamp 2023" }).length).toBeGreaterThan(0);
    expect(buscar(eds, insts, { q: "pas unb 2023" }).every((e) => e.instituicao === "pas-unb")).toBe(true);
    expect(buscar(eds, insts, { q: "Universidade Presbiteriana" }).every((e) => e.instituicao === "mackenzie")).toBe(true);
  });
});

describe("filtros combináveis", () => {
  it("filtra por fase, dia, disciplina, tipo e ano ao mesmo tempo", () => {
    const f = buscar(eds, insts, { instituicao: "comvest", fase: "2ª fase", dia: "2º dia", de: 2023, ate: 2026, tipo: "gabarito" });
    expect(f.length).toBeGreaterThan(0);
    for (const e of f) { expect(e.instituicao).toBe("comvest"); expect(e.fase).toBe("2ª fase"); expect(e.dia).toBe("2º dia"); expect(e.ano).toBeGreaterThanOrEqual(2023); expect(e.ano).toBeLessThanOrEqual(2026); expect(e.arquivos.some((a) => a.tipo === "gabarito")).toBe(true); }
    const mat = buscar(eds, insts, { instituicao: "uerj", disciplina: "Matemática" });
    expect(mat.length).toBeGreaterThan(0);
    expect(mat.every((e) => e.arquivos.some((a) => /matem/i.test(a.rotulo)))).toBe(true);
    const ita = buscar(eds, insts, { instituicao: "ita", fase: "1ª fase" });
    expect(ita.length).toBeGreaterThan(0);
  });
  it("ordena por ano (recentes ou antigos primeiro)", () => {
    const rec = buscar(eds, insts, { instituicao: "ita", ordem: "recentes" }).map((e) => e.ano);
    const ant = buscar(eds, insts, { instituicao: "ita", ordem: "antigos" }).map((e) => e.ano);
    expect(rec).toEqual([...rec].sort((a, b) => b - a)); expect(ant).toEqual([...ant].sort((a, b) => a - b));
  });
  it("lista valores distintos de fase e dia para os filtros", () => {
    expect(valoresDistintos(eds, "fase")).toContain("1ª fase");
    expect(valoresDistintos(eds, "dia")).toContain("1º dia");
  });
});

describe("downloads", () => {
  it("cada arquivo tem link próprio /baixar/<edição>/<n> que resolve para a URL oficial do próprio arquivo", () => {
    for (const { e, a, n } of arquivos.slice(0, 3000)) {
      expect(linkDownload(e, n)).toBe(`/baixar/${e.id}/${n}`);
      expect(resolverDownload(eds, e.id, String(n))).toBe(a.url);
    }
  });
  it("recusa ids e índices inexistentes ou malformados", () => {
    expect(resolverDownload(eds, "nao-existe", "0")).toBeNull();
    expect(resolverDownload(eds, eds[0].id, "999")).toBeNull();
    expect(resolverDownload(eds, eds[0].id, "-1")).toBeNull();
    expect(resolverDownload(eds, eds[0].id, "0x1")).toBeNull();
  });
});

describe("cobertura", () => {
  const cob = coberturaGeral(insts, eds, VERIFICACAO_BRUTA as never);
  it("tem uma linha por instituição e os totais batem com o catálogo", () => {
    expect(cob).toHaveLength(20);
    expect(cob.reduce((n, c) => n + c.arquivos, 0)).toBe(arquivos.length);
    expect(cob.reduce((n, c) => n + c.edicoes, 0)).toBe(eds.length);
    expect(cob.reduce((n, c) => n + c.provas + c.gabaritos + c.outros, 0)).toBe(arquivos.length);
  });
  it("instituições sem arquivos aparecem como sem documentos, sem anos inventados", () => {
    for (const c of cob.filter((x) => x.arquivos === 0)) { expect(c.situacao).toBe("sem-documentos"); expect(c.anos).toEqual([]); expect(c.primeiro).toBeNull(); }
    expect(cob.some((c) => c.arquivos === 0)).toBe(true);
  });
  it("nunca marca anos sem arquivo como disponíveis: 1990, 1992 e 1995 não cobrem 1991, 1993 e 1994", () => {
    expect(faixas([1990, 1992, 1995])).toBe("1990, 1992, 1995");
    expect(faixas([1990, 1991, 1992, 1995])).toBe("1990–1992, 1995");
    expect(buracos([1990, 1992, 1995])).toEqual([1991, 1993, 1994]);
    const i = insts[0];
    const falsa = coberturaDe(i, [{ id: "a", instituicao: i.slug, ano: 1990, nome: "A", fonte: "https://x.org/a", arquivos: [{ tipo: "prova", rotulo: "P", url: "https://x.org/1.pdf", formato: "pdf" }] }, { id: "b", instituicao: i.slug, ano: 1995, nome: "B", fonte: "https://x.org/b", arquivos: [{ tipo: "gabarito", rotulo: "G", url: "https://x.org/2.pdf", formato: "pdf" }] }] as never, {});
    expect(falsa.anos).toEqual([1990, 1995]); expect(falsa.anosSemGabarito).toEqual([1990]); expect(falsa.anosSemProva).toEqual([1995]); expect(falsa.naoVerificados).toBe(2);
  });
  it("nenhuma instituição é declarada 'completa'", () => { for (const c of cob) expect(["sem-documentos", "parcial", "ampla"]).toContain(c.situacao); });
});
