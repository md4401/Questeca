import { test, expect as baseExpect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signup } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 10000 });

const audit = async (page: Page, name: string) => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(`A11Y ${name}:`, bad.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target?.join(" ")}`).join(" | "));
  expect(bad, `${name}: ${bad.map((v) => v.id).join(", ")}`).toEqual([]);
};

test("Busca do banco: autor, obra e assuntos relacionados, filtros e destaque", async ({ page: t }) => {
  test.setTimeout(90_000);
  await signup(t);
  const busca = async (q: string, extra = "") => { await t.goto(`/app/banco?q=${encodeURIComponent(q)}${extra}`); };
  const cards = () => t.getByTestId("resultado-questao");

  // Machado de Assis: acha as questões sobre o autor e suas obras
  await busca("Machado de Assis");
  await expect(t.getByTestId("busca-entendida")).toContainText("Machado de Assis");
  expect(await cards().count()).toBeGreaterThanOrEqual(6);
  await expect(cards().filter({ hasText: "Dom Casmurro: a dúvida central" })).toHaveCount(1);
  await expect(cards().filter({ hasText: "Memórias Póstumas: o defunto-autor" })).toHaveCount(1);
  await expect(cards().filter({ hasText: "Quincas Borba e o Humanitismo" })).toHaveCount(1);
  await expect(cards().filter({ hasText: /Cita: Machado de Assis/ }).first()).toBeVisible();
  await expect(cards().filter({ hasText: /Relacionada: / }).first()).toBeVisible();
  await expect(t.locator("mark.hl").first()).toBeVisible();
  // não traz o que não tem relação
  await expect(cards().filter({ hasText: "Desconto simples em camisa" })).toHaveCount(0);
  await expect(cards().filter({ hasText: "A hora da estrela" })).toHaveCount(0);
  await audit(t, "banco-busca");

  // sem acento, caixa diferente e achando só pela obra
  await busca("MACHADO");
  expect(await cards().count()).toBeGreaterThanOrEqual(6);
  await busca("dom casmurro");
  await expect(cards().filter({ hasText: "Dom Casmurro: a dúvida central" })).toHaveCount(1);
  await busca("capitu");
  await expect(cards().first()).toContainText("Dom Casmurro");

  // outro autor
  await busca("Clarice Lispector");
  await expect(cards().first()).toContainText("Clarice Lispector");
  await expect(cards().filter({ hasText: "Dom Casmurro: a dúvida central" })).toHaveCount(0);

  // assunto de outra disciplina e palavras livres
  await busca("juros compostos");
  expect(await cards().count()).toBeGreaterThanOrEqual(1);
  await expect(cards().filter({ hasText: "Dom Casmurro" })).toHaveCount(0);

  // filtros: disciplina e banca
  await busca("realismo", "&disciplina=literatura");
  expect(await cards().count()).toBeGreaterThanOrEqual(3);
  await busca("Machado de Assis", "&fonte=Inep");
  await expect(cards()).toHaveCount(0);
  await expect(t.getByText(/Nenhuma questão encontrada/)).toBeVisible();
  await busca("Machado de Assis", "&disciplina=matematica");
  await expect(cards()).toHaveCount(0);

  // sem busca: lista o acervo com filtros de disciplina
  await t.goto("/app/banco?disciplina=literatura");
  expect(await cards().count()).toBeGreaterThanOrEqual(8);
  await expect(t.getByLabel("Banca / fonte")).toBeVisible();
  await expect(t.getByLabel("Disciplina")).toHaveValue("literatura");
});
