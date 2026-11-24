import { describe, it, expect } from "vitest";
import { extrairJson } from "@/lib/core/json";

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
