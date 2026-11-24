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
  await busca("Machado de Assis", "&fonte=Segunda+Lousa"); // acervo de exemplo (o banco real tem mais questões com o sobrenome Machado)
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
  await busca("Machado de Assis", "&disciplina=matematica&fonte=Segunda+Lousa");
  await expect(cards()).toHaveCount(0);

  // sem busca: lista o acervo com filtros de disciplina
  await t.goto("/app/banco?disciplina=literatura");
  expect(await cards().count()).toBeGreaterThanOrEqual(8);
  await expect(t.getByLabel("Banca / fonte")).toBeVisible();
  await expect(t.getByLabel("Disciplina")).toHaveValue("literatura");
});

test("Banco: aba Provas e gabaritos oficiais (catálogo de Enem, Fuvest, Unicamp…)", async ({ page: t }) => {
  test.setTimeout(60_000);
  await signup(t);
  await t.goto("/app/banco");
  await t.getByRole("link", { name: "Provas e gabaritos oficiais" }).click();
  await t.waitForURL(/aba=provas/);
  await expect(t.getByRole("heading", { level: 1, name: "Provas e gabaritos oficiais" })).toBeVisible();
  await expect(t.getByText(/658 edições e 2809 arquivos/)).toBeVisible();
  // Enem 2023: só Enem, com prova e gabarito, links para o site oficial
  await t.goto("/app/banco?aba=provas&q=enem+2023");
  const cards = t.getByTestId("edicao-oficial");
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(cards.first()).toContainText(/ENEM · 2023/i);
  await expect(cards.first().getByText("Prova", { exact: true }).first()).toBeVisible();
  await expect(cards.first().getByText("Gabarito", { exact: true }).first()).toBeVisible();
  const href = await cards.first().getByRole("link", { name: /Abrir PDF: .*\(ENEM 2023\)/i }).first().getAttribute("href");
  expect(href).toMatch(/^https:\/\/.*inep\.gov\.br/); 
  expect(await cards.first().getByRole("link", { name: /Abrir/ }).first().getAttribute("target")).toBe("_blank");
  // siglas populares e filtros
  await t.goto("/app/banco?aba=provas&q=usp&tipo=gabarito");
  await expect(t.getByTestId("edicao-oficial").first()).toContainText(/FUVEST/i);
  await t.goto("/app/banco?aba=provas&inst=comvest&ano=2020");
  await expect(t.getByTestId("edicao-oficial").first()).toContainText(/COMVEST/i);
  await t.goto("/app/banco?aba=provas&q=zzzxxyy");
  await expect(t.getByText(/Nenhuma edição encontrada/)).toBeVisible();
  // paginação
  await t.goto("/app/banco?aba=provas&inst=enem");
  await expect(t.getByText(/página 1 de 5/)).toBeVisible();
  await t.getByRole("link", { name: "Próxima →" }).first().click();
  await expect(t.getByText(/Página 2 de 5/).first()).toBeVisible();
  await audit(t, "provas-oficiais");
});
