import { describe, it, expect } from "vitest";
import { validarCatalogo } from "@/lib/validacao";
import { buscar, agruparPorAno, normalizar } from "@/lib/busca";
import { resolverDownload } from "@/lib/download";
import { lerCsv, agruparCsv, mesclar, idDe } from "@/lib/importar";
import { EDICOES_BRUTAS, INSTITUICOES_BRUTAS, VERIFICACAO_BRUTA } from "@/lib/dados";
import type { Edicao, Instituicao } from "@/lib/tipos";

const inst = (slug: string, extra: Partial<Instituicao> = {}) => ({ slug, nome: `Instituição ${slug}`, sigla: slug.toUpperCase(), categoria: "vestibular", descricao: "Descrição de teste da instituição.", site: "https://exemplo.org", paginaProvas: null, primeiraEdicao: null, ...extra });
const ed = (id: string, instituicao: string, ano: number, extra: Partial<Edicao> = {}): Edicao => ({ id, instituicao, ano, nome: `Vestibular ${ano}`, fonte: "https://exemplo.org/provas", arquivos: [{ tipo: "prova", rotulo: "Prova", url: `https://exemplo.org/${id}-p.pdf`, formato: "pdf" }, { tipo: "gabarito", rotulo: "Gabarito", url: `https://exemplo.org/${id}-g.pdf`, formato: "pdf" }], ...extra });
const catalogo = (instituicoes: unknown, edicoes: Record<string, unknown>, verificacao: unknown = {}) => validarCatalogo({ instituicoes, edicoes, verificacao });

describe("catálogo real do projeto", () => {
  it("as 20 instituições pedidas existem e o catálogo é válido", () => {
    const r = validarCatalogo({ instituicoes: INSTITUICOES_BRUTAS, edicoes: EDICOES_BRUTAS, verificacao: VERIFICACAO_BRUTA });
    expect(r.erros).toEqual([]);
    expect(r.instituicoes.map((i) => i.slug).sort()).toEqual(["afa", "comvest", "enem", "espcex", "espm", "einstein", "fatec", "fgv", "fuvest", "ime", "insper", "ita", "mackenzie", "pas-unb", "puc-sp", "ufpr", "ufrgs", "uerj", "univesp", "vunesp"].sort());
  });

  it("COMVEST/Unicamp: 1987–2027, só arquivos do domínio oficial, sem URLs repetidas e sem simulados/editais", () => {
    const r = validarCatalogo({ instituicoes: INSTITUICOES_BRUTAS, edicoes: EDICOES_BRUTAS, verificacao: VERIFICACAO_BRUTA });
    const c = r.edicoes.filter((e) => e.instituicao === "comvest");
    const anos = [...new Set(c.map((e) => e.ano))];
    expect(Math.min(...anos)).toBe(1987); expect(Math.max(...anos)).toBe(2027);
    const arqs = c.flatMap((e) => e.arquivos);
    expect(arqs.length).toBeGreaterThan(500);
    expect(new Set(arqs.map((a) => a.url)).size).toBe(arqs.length);
    expect(arqs.every((a) => new URL(a.url).hostname === "www.comvest.unicamp.br" && a.url.startsWith("https://"))).toBe(true);
    expect(arqs.some((a) => /simulado|edital|manual|abstenc/i.test(a.url + a.rotulo))).toBe(false);
    expect(arqs.filter((a) => a.tipo === "prova").length).toBeGreaterThan(300);
    expect(arqs.filter((a) => a.tipo === "gabarito").length).toBeGreaterThan(150);
  });
});

describe("validação", () => {
  it("aceita um catálogo correto", () => {
    const r = catalogo([inst("aaa", { primeiraEdicao: 2000 })], { aaa: [ed("aaa-2020", "aaa", 2020)] });
    expect(r.erros).toEqual([]); expect(r.edicoes).toHaveLength(1);
  });
  it("recusa URL insegura, id duplicado, ano antes da primeira edição e instituição inexistente", () => {
    expect(catalogo([inst("aaa")], { aaa: [ed("aaa-1", "aaa", 2020, { arquivos: [{ tipo: "prova", rotulo: "Prova", url: "javascript:alert(1)", formato: "pdf" }] })] }).erros.join()).toMatch(/http/);
    expect(catalogo([inst("aaa")], { aaa: [ed("aaa-1", "aaa", 2020), ed("aaa-1", "aaa", 2021)] }).erros.join()).toMatch(/duplicado/);
    expect(catalogo([inst("aaa", { primeiraEdicao: 2010 })], { aaa: [ed("aaa-2005", "aaa", 2005)] }).erros.join()).toMatch(/anterior à primeira edição/);
    expect(catalogo([inst("aaa")], { zzz: [] }).erros.join()).toMatch(/zzz/);
    expect(catalogo([inst("aaa")], { aaa: [ed("aaa-1", "bbb", 2020)] }).erros.join()).toMatch(/não bate/);
  });
  it("avisa de gabarito ausente e URL repetida, sem bloquear", () => {
    const sem = ed("aaa-1", "aaa", 2020, { arquivos: [{ tipo: "prova", rotulo: "Prova", url: "https://exemplo.org/a.pdf", formato: "pdf" }] });
    const r = catalogo([inst("aaa")], { aaa: [sem, ed("aaa-2", "aaa", 2021, { arquivos: [{ tipo: "gabarito", rotulo: "Gab", url: "https://exemplo.org/a.pdf", formato: "pdf" }] })] });
    expect(r.erros).toEqual([]); expect(r.avisos.join()).toMatch(/sem gabarito/); expect(r.avisos.join()).toMatch(/URL repetida/);
  });
});

describe("busca", () => {
  const insts = [inst("enem", { sigla: "ENEM", nome: "Exame Nacional do Ensino Médio" }), inst("fuvest", { sigla: "Fuvest" })] as unknown as Instituicao[];
  const lista = [ed("enem-2019-d1", "enem", 2019, { nome: "ENEM 2019 · 1º dia" }), ed("enem-2020-d1", "enem", 2020, { nome: "ENEM 2020 · 1º dia" }), ed("fuvest-2019", "fuvest", 2019, { nome: "Fuvest 2019 · 1ª fase" })];
  it("ignora acento e caixa e exige todas as palavras", () => {
    expect(normalizar("Média: 1ª Fase!")).toBe("media 1 fase");
    expect(buscar(lista, insts, { q: "enem 2019" }).map((e) => e.id)).toEqual(["enem-2019-d1"]);
    expect(buscar(lista, insts, { q: "1a fase" })).toHaveLength(0);
    expect(buscar(lista, insts, { q: "1ª fase" }).map((e) => e.id)).toEqual(["fuvest-2019"]);
    expect(buscar(lista, insts, { q: "ensino medio" })).toHaveLength(2);
  });
  it("filtra por instituição, período e tipo; agrupa por ano decrescente", () => {
    expect(buscar(lista, insts, { instituicao: "fuvest" })).toHaveLength(1);
    expect(buscar(lista, insts, { de: 2020 }).map((e) => e.ano)).toEqual([2020]);
    expect(buscar(lista, insts, { ate: 2019 })).toHaveLength(2);
    expect(buscar(lista, insts, { tipo: "comentada" })).toHaveLength(0);
    expect(agruparPorAno(lista).map(([a, es]) => `${a}:${es.length}`)).toEqual(["2020:1", "2019:2"]);
  });
});

describe("download", () => {
  const lista = [ed("enem-2019", "enem", 2019)];
  it("resolve só arquivos do catálogo e recusa índices e ids inválidos", () => {
    expect(resolverDownload(lista, "enem-2019", "0")).toBe("https://exemplo.org/enem-2019-p.pdf");
    expect(resolverDownload(lista, "enem-2019", "1")).toBe("https://exemplo.org/enem-2019-g.pdf");
    expect(resolverDownload(lista, "enem-2019", "2")).toBeNull();
    expect(resolverDownload(lista, "enem-2019", "-1")).toBeNull();
    expect(resolverDownload(lista, "enem-2019", "0x1")).toBeNull();
    expect(resolverDownload(lista, "outro", "0")).toBeNull();
  });
});

describe("importação por CSV", () => {
  const csv = `instituicao;ano;nome;tipo;rotulo;url;formato;fonte;observacao
enem;2019;ENEM 2019 · 1º dia;prova;Prova;https://exemplo.org/p.pdf;pdf;https://exemplo.org/provas;
enem;2019;ENEM 2019 · 1º dia;gabarito;"Gabarito; oficial";https://exemplo.org/g.pdf;pdf;https://exemplo.org/provas;"Aplicação regular"
enem;2019;ENEM 2019 · 1º dia;gabarito;Gabarito repetido;https://exemplo.org/g.pdf;pdf;https://exemplo.org/provas;
enem;xx;Ruim;prova;P;https://exemplo.org/z.pdf;pdf;https://exemplo.org/provas;`;
  it("lê aspas e separador, agrupa por edição e ignora URL repetida", () => {
    const linhas = lerCsv(csv); expect(linhas).toHaveLength(4); expect(linhas[1].rotulo).toBe("Gabarito; oficial");
    const { edicoes, erros } = agruparCsv(linhas);
    expect(erros).toHaveLength(1); expect(erros[0]).toMatch(/linha 5/);
    expect(edicoes).toHaveLength(1); expect(edicoes[0].arquivos.map((a) => a.tipo)).toEqual(["prova", "gabarito"]); expect(edicoes[0].observacao).toBe("Aplicação regular");
    expect(edicoes[0].id).toBe("enem-2019-1-dia");
  });
  it("gera ids estáveis e mescla sem duplicar", () => {
    expect(idDe("fuvest", 2023, "Fuvest 2023 · 1ª fase")).toBe("fuvest-2023-1-fase");
    const a = [ed("aaa-2020", "aaa", 2020)];
    const novo = ed("aaa-2020", "aaa", 2020, { arquivos: [{ tipo: "comentada", rotulo: "Comentada", url: "https://exemplo.org/c.pdf", formato: "pdf" }, { tipo: "prova", rotulo: "Prova", url: "https://exemplo.org/aaa-2020-p.pdf", formato: "pdf" }] });
    const m = mesclar(a, [novo, ed("aaa-2021", "aaa", 2021)]);
    expect(m.map((e) => e.id)).toEqual(["aaa-2021", "aaa-2020"]); expect(m[1].arquivos).toHaveLength(3);
  });
});
