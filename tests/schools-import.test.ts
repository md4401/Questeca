import { describe, it, expect } from "vitest";
import { titleCase, toSchool, missingColumns } from "@/lib/core/schools-import";

// Linhas SINTÉTICAS no layout do Censo Escolar (nomes inventados).
const base = { CO_ENTIDADE: "35000001", NO_ENTIDADE: "COLEGIO HORIZONTE DE EXEMPLO", SG_UF: "sp", NO_MUNICIPIO: "OSASCO", NO_BAIRRO: "CENTRO", TP_DEPENDENCIA: "4", TP_SITUACAO_FUNCIONAMENTO: "1", IN_FUND_AF: "1", IN_MED: "0" };

describe("importação do Censo Escolar", () => {
  it("normaliza maiúsculas, preposições e siglas", () => {
    expect(titleCase("COLEGIO SAO JOAO DA BOA VISTA")).toBe("Colegio Sao Joao da Boa Vista");
    expect(titleCase("EMEF PROF ANA LIMA")).toBe("EMEF Prof Ana Lima");
    expect(titleCase("E.E. DOM PEDRO II")).toBe("E.e. Dom Pedro II");
    expect(titleCase("ESCOLA MUNICIPAL ANITA GARIBALDI-CENTRO")).toBe("Escola Municipal Anita Garibaldi-Centro");
  });
  it("aceita escola ativa com anos finais ou médio", () => {
    expect(toSchool(base)).toMatchObject({ inepCode: "35000001", name: "Colegio Horizonte de Exemplo", city: "Osasco", uf: "SP", neighborhood: "Centro", dependency: "Privada", nameNorm: "colegio horizonte de exemplo", cityNorm: "osasco" });
    expect(toSchool({ ...base, IN_FUND_AF: "0", IN_MED: "1" })).not.toBeNull();
  });
  it("descarta inativas, só-infantil, códigos e UFs inválidos", () => {
    expect(toSchool({ ...base, TP_SITUACAO_FUNCIONAMENTO: "2" })).toBeNull();
    expect(toSchool({ ...base, IN_FUND_AF: "0", IN_MED: "0" })).toBeNull();
    expect(toSchool({ ...base, CO_ENTIDADE: "abc" })).toBeNull();
    expect(toSchool({ ...base, SG_UF: "XYZ" })).toBeNull();
    expect(toSchool({ ...base, NO_ENTIDADE: "  " })).toBeNull();
  });
  it("funciona sem as colunas opcionais e detecta colunas obrigatórias ausentes", () => {
    const { TP_SITUACAO_FUNCIONAMENTO: _a, IN_FUND_AF: _b, IN_MED: _c, NO_BAIRRO: _d, ...min } = base;
    expect(toSchool(min)).toMatchObject({ neighborhood: null });
    expect(missingColumns(Object.keys(min))).toEqual([]);
    expect(missingColumns(["CO_ENTIDADE"])).toEqual(["NO_ENTIDADE", "SG_UF", "NO_MUNICIPIO"]);
  });
});
