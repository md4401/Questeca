import { test, expect } from "@playwright/test";
import { signup, createClass, pdfText } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const TEXT = "Matemática, 9º B. Ensinei porcentagem simples e descontos sucessivos. Ainda não trabalhei juros compostos.";

async function newExam(page: import("@playwright/test").Page, classId: string, text = TEXT, title = "Prova de porcentagem") {
  await page.goto(`/app/provas/nova?turma=${classId}`);
  await page.getByLabel("Título da prova").fill(title);
  await page.getByLabel("O que a turma estudou?").fill(text);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForURL(/\/escopo$/);
  return page.url().split("/").slice(-2)[0];
}


test("AV-01/03/04/05 · SA-03: primeira prova sem alunos, filtro por pré-requisito, editor e PDFs", async ({ page, request, context }) => {
  await signup(page, { name: "Professora AV" });
  const classId = await createClass(page);

  // modelo da escola (cabeçalho + logo)
  await page.goto("/app/escola");
  await page.locator("#schoolName").fill("Colégio Exemplo");
  await page.getByLabel(/^Logo/).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Salvar modelo" }).click();
  await expect(page.getByText(/Modelo salvo/)).toBeVisible();

  const id = await newExam(page, classId);
  // 4 listas reconhecidas
  await expect(page.locator("select[name=t_descontos-sucessivos]")).toHaveValue("f");
  await expect(page.locator("select[name=t_porcentagem-simples]")).toHaveValue("f");
  await expect(page.locator("select[name=t_juros-compostos]")).toHaveValue("n");
  await page.getByLabel("Quantidade de questões").fill("8");
  await page.getByRole("button", { name: "Buscar questões" }).click();
  await page.waitForURL(new RegExp(`/app/provas/${id}\\?`));
  await expect(page.getByRole("heading", { name: "Prova de porcentagem" })).toBeVisible();
  await expect(page.getByText("Dois descontos de 10%").or(page.getByText(/Um produto de R\$ 200,00 recebe/)).first()).toBeVisible();
  // item que exige juros compostos nunca entra
  await expect(page.getByText("Dívida com juros sobre juros")).toHaveCount(0);
  await expect(page.getByText(/Uma dívida de R\$ 1\.000,00 cresce/)).toHaveCount(0);
  const nItems = await page.locator("article[aria-label^='Questão']").count();
  expect(nItems).toBe(8);

  // AV-01 (2º caso): descontos sucessivos vira "Ainda não ensinei" → itens saem mesmo com porcentagem
  await page.goto(`/app/provas/${id}/escopo`);
  await page.locator("select[name=t_descontos-sucessivos]").selectOption("n");
  await page.getByRole("button", { name: "Buscar questões" }).click();
  await page.waitForURL(new RegExp(`/app/provas/${id}\\?`));
  await expect(page.getByText(/Encontramos \d de 8 questões compatíveis/)).toBeVisible();
  await expect(page.getByText(/Um produto de R\$ 200,00 recebe um desconto de 10%/)).toHaveCount(0);

  // AV-04: fixar, trocar, reordenar, recarregar mantém
  const first = page.locator("article[aria-label='Questão 1']");
  const firstStatement = (await first.locator("p.statement").first().textContent())!;
  await first.getByRole("button", { name: "Fixar" }).click();
  await expect(page.locator("article[aria-label='Questão 1']").getByText("fixada")).toBeVisible();
  await page.locator("article[aria-label='Questão 2']").getByRole("button", { name: /Mover questão 2 para cima/ }).click();
  await expect(page.locator("article[aria-label='Questão 1'] p.statement").first()).not.toHaveText(firstStatement);
  await page.reload();
  expect(await page.locator("article[aria-label='Questão 2'] p.statement").first().textContent()).toBe(firstStatement);
  await page.locator("article[aria-label='Questão 3']").getByRole("link", { name: "Trocar" }).click();
  const useBtn = page.getByRole("button", { name: "Usar esta" }).first();
  if (await useBtn.count()) { await useBtn.click(); await expect(page.getByRole("heading", { name: "Prova de porcentagem" })).toBeVisible(); }
  // desfazer restaura
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.locator("article[aria-label^='Questão']").first()).toBeVisible();
  // refazer sugestões preserva itens fixados
  const pinnedBefore = await page.locator("article:has-text('fixada') p.statement").first().textContent();
  await page.goto(`/app/provas/${id}/escopo`);
  await page.getByRole("button", { name: "Buscar questões" }).click();
  await page.waitForURL(new RegExp(`/app/provas/${id}\\?`));
  await expect(page.locator("article:has-text('fixada') p.statement").first()).toHaveText(pinnedBefore!);

  // AV-05: PDF do aluno sem gabarito; PDF do professor com gabarito; cabeçalho aplicado
  const stu = await pdfText(request, `/api/export/prova?id=${id}&tipo=aluno&rascunho=1`).catch(() => null);
  void stu; // o request fixture não compartilha cookies; usar o contexto da página abaixo
  const cookies = await context.cookies();
  const authed = await (await import("@playwright/test")).request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") } });
  const student = await pdfText(authed, `/api/export/prova?id=${id}&tipo=aluno&rascunho=1`);
  expect(student).toContain("Colégio Exemplo");
  expect(student).toContain("Aluno(a):");
  expect(student).toContain("1.");
  expect(student).not.toMatch(/Resposta:|Gabarito/);
  const teacher = await pdfText(authed, `/api/export/prova?id=${id}&tipo=professor&rascunho=1`);
  expect(teacher).toMatch(/Gabarito/);
  expect(teacher).toMatch(/Resposta: [A-E]/);
  // Word bloqueado no plano gratuito
  const docx = await authed.get(`/api/export/prova?id=${id}&tipo=aluno&formato=docx&rascunho=1`);
  expect(docx.status()).toBe(403);
  // prévia mostra alertas e links
  await page.goto(`/app/provas/${id}/previa`);
  await expect(page.getByRole("link", { name: "Baixar PDF do aluno" })).toBeVisible();
  await expect(page.locator("iframe[title*='Prévia']")).toBeVisible();
});

test("AV-02: 6 de 8 → cobertura insuficiente com ações", async ({ page }) => {
  await signup(page);
  const classId = await createClass(page);
  const id = await newExam(page, classId, "Ensinei porcentagem simples.", "Só porcentagem");
  await page.getByLabel("Quantidade de questões").fill("8");
  await page.getByRole("button", { name: "Buscar questões" }).click();
  await page.waitForURL(new RegExp(`/app/provas/${id}\\?`));
  await expect(page.getByText(/Encontramos \d de 8 questões compatíveis/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ampliar fontes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajustar conteúdos" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Usar as \d+$/ })).toBeVisible();
});

test("AV-08: questão só referência não pode ser incluída; link consultável", async ({ page }) => {
  await signup(page);
  await page.goto("/app/banco?q=Enem+2013");
  const card = page.locator("li.card", { hasText: "Enem 2013 · 2º dia · Caderno 7 azul · Questão 163" });
  await expect(card).toBeVisible();
  await expect(card.locator(".badge", { hasText: "Só referência" })).toBeVisible();
  await expect(card.getByRole("link", { name: "Ver fonte original" })).toHaveAttribute("href", /inep/);
  await expect(card.getByRole("button", { name: "Adicionar à prova" })).toHaveCount(0);
  await expect(card.getByText(/Não pode ser incluída/)).toBeVisible();
  void PNG;
});
