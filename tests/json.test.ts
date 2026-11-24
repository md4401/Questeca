import { describe, it, expect } from "vitest";
import { extrairJson, interpretarResposta } from "@/lib/core/json";

describe("extrairJson (resposta do assistente)", () => {
  it("lê objeto puro e com texto ao redor", () => {
    expect(extrairJson('{"acao":"responder","texto":"oi"}')).toEqual({ acao: "responder", texto: "oi" });
    expect(extrairJson('Claro! ```json\n{"acao":"ferramenta","nome":"minhas_turmas","args":{}}\n``` pronto')).toEqual({ acao: "ferramenta", nome: "minhas_turmas", args: {} });
  });
  it("respeita chaves dentro de strings e objetos aninhados", () => {
    expect(extrairJson('{"a":{"b":"} fake {"},"c":2} cauda {')).toEqual({ a: { b: "} fake {" }, c: 2 });
  });
  it("devolve null quando não há JSON válido", () => {
    expect(extrairJson("sem json")).toBeNull();
    expect(extrairJson("{quebrado")).toBeNull();
  });
});

describe("interpretarResposta (formatos que o modelo erra)", () => {
  const f = ["buscar_questoes", "gerar_prova"];
  it("aceita o formato correto", () => {
    expect(interpretarResposta({ acao: "ferramenta", nome: "gerar_prova", args: { a: 1 } }, f)).toEqual({ tipo: "ferramenta", nome: "gerar_prova", args: { a: 1 } });
  });
  it("aceita o nome da ferramenta em 'acao' (erro real visto com o modelo)", () => {
    expect(interpretarResposta({ acao: "buscar_questoes", nome: "buscar_questoes", args: { temas: ["x"] } }, f)).toEqual({ tipo: "ferramenta", nome: "buscar_questoes", args: { temas: ["x"] } });
    expect(interpretarResposta({ acao: "gerar_prova", argumentos: { n: 2 } }, f)).toEqual({ tipo: "ferramenta", nome: "gerar_prova", args: { n: 2 } });
  });
  it("texto final por 'texto' ou 'resposta'", () => {
    expect(interpretarResposta({ acao: "responder", texto: "oi" }, f)).toEqual({ tipo: "texto", texto: "oi" });
    expect(interpretarResposta({ resposta: "olá" }, f)).toEqual({ tipo: "texto", texto: "olá" });
  });
  it("formato inválido não vira texto", () => {
    expect(interpretarResposta({ acao: "inventada" }, f)).toEqual({ tipo: "invalida" });
  });
});
