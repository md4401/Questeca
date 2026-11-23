import { test, expect, type Page } from "@playwright/test";
import { signup, createClass, addStudents, sql } from "./helpers";

const TEXT = "Ensinei porcentagem simples e descontos sucessivos. Ainda não trabalhei juros compostos.";
const png = (extra = "") => Buffer.concat([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"), Buffer.from(extra)]);

async function exam(page: Page, classId: string, wanted = 5, title = "Prova de porcentagem") {
  await page.goto(`/app/provas/nova?turma=${classId}`);
  await page.getByLabel("Título da prova").fill(title);
  await page.getByLabel("O que a turma estudou?").fill(TEXT);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForURL(/\/escopo$/);
  const id = page.url().split("/").slice(-2)[0];
  await page.getByLabel("Quantidade de questões").fill(String(wanted));
  await page.getByRole("button", { name: "Buscar questões" }).click();
  await page.waitForURL(new RegExp(`/app/provas/${id}\\?`));
  return id;
}

const statements = async (page: Page) => (await page.locator("article[aria-label^='Questão'] p.statement").allTextContents()).map((s) => s.trim());

test("correção, resultados, notas, cartões, segunda chamada, versões e cobrança (SA-06/09, AV-06/07)", async ({ page }) => {
  test.setTimeout(420_000);
  await signup(page, { name: "Professora Correção" });
  const classId = await createClass(page, "9º D");
  await addStudents(page, classId, "Ana Lima;3001\nBeto Cruz;3002\nCris Melo;3003\nDuda Reis;3004");
  const id = await exam(page, classId, 5);
  const originalStatements = await statements(page);
  expect(originalStatements).toHaveLength(5);

  // aplicar
  await page.goto(`/app/provas/${id}/aplicacao`);
  await page.getByRole("button", { name: /Confirmar aplicação/ }).click();
  await page.waitForURL(/\/correcao\?app=/);
  const appUrl = page.url();
  const keyText = (await page.getByText(/Gabarito da versão aplicada:/).textContent())!;
  const keys = [...keyText.matchAll(/(\d)([A-E])/g)].map((m) => m[2]);
  expect(keys).toHaveLength(5);

  // respostas: Ana acerta tudo, Beto erra tudo, Cris em branco, Duda ausente
  const wrong = (k: string) => (k === "A" ? "B" : "A");
  for (let q = 1; q <= 5; q++) {
    const set = async (who: string, v: string) => { const c = page.getByLabel(`${who} — questão ${q}`); await c.fill(v); await c.blur(); };
    await set("Ana Lima", keys[q - 1]);
    await set("Beto Cruz", wrong(keys[q - 1]));
    await set("Cris Melo", "-");
  }
  await page.getByLabel("Duda Reis ausente").check();
  await expect(page.locator("tr", { hasText: "Ana Lima" }).first().locator("td").last()).toHaveText("10", { timeout: 90_000 });
  await expect(page.locator("tr", { hasText: "Beto Cruz" }).first().locator("td").last()).toHaveText("0");
  await expect(page.locator("tr", { hasText: "Duda Reis" }).first().locator("td").last()).toHaveText("F");

  // aguarda a fila de gravações terminar (3 alunos × 5 respostas) antes de sair da tela
  const appId = appUrl.split("app=")[1];
  await expect.poll(async () => Number((await sql`select count(*)::int as n from responses where application_id = ${appId}`)[0].n), { timeout: 120_000, intervals: [1000] }).toBe(15);
  await expect.poll(async () => Number((await sql`select count(*)::int as n from student_presence where application_id = ${appId} and state = 'absent'`)[0].n), { timeout: 30_000 }).toBe(1);

  // resultados (SA-06): análise por item e por habilidade com quantidade válida
  await page.goto(appUrl.replace("/correcao", "/resultados"));
  await expect(page.getByText(/3 aluno\(s\) com leitura completa de 4 · 1 ausente\(s\)/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Por questão" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Por habilidade/conteúdo" })).toBeVisible();
  await expect(page.getByText(/Amostra pequena/)).toBeVisible();
  await expect(page.locator("table").first().locator("tbody tr")).toHaveCount(5);
  await expect(page.getByText("Preparar retomada")).toBeVisible(); // acerto 33% < 60%

  // notas na turma: presentes, ausente e pendente
  await page.goto(appUrl);
  await page.getByRole("button", { name: "Confirmar notas no registro da turma" }).click();
  await expect(page.getByText(/3 confirmada\(s\), 1 ausente\(s\), 0 pendente\(s\)/)).toBeVisible();
  await page.goto(`/app/turmas/${classId}/notas`);
  await expect(page.getByLabel("Ana Lima — Prova de porcentagem")).toHaveValue("10");
  await expect(page.getByLabel("Duda Reis — Prova de porcentagem")).toHaveValue("F");
  await expect(page.getByLabel("Cris Melo — Prova de porcentagem")).toHaveValue("0"); // em branco registrado conta zero (≠ pendente)

  // retomada com questões reais do acervo e checagem
  await page.goto(`/app/turmas/${classId}/relatorios`);
  await expect(page.getByText(/% de acerto/)).toBeVisible();
  await page.getByRole("button", { name: "Checagem de 3 questões curtas" }).click();
  await page.waitForURL(/\/app\/provas\/[0-9a-f-]{36}\?/);
  await expect(page.getByRole("heading", { name: /Checagem/ })).toBeVisible();

  // plano gratuito: sem cartões por foto e sem segunda chamada
  await page.goto(appUrl);
  await expect(page.getByText(/Correção por foto está nos planos Professor e Escola/)).toBeVisible();
  await page.goto(`/app/provas/${id}/aplicacao`);
  await expect(page.getByText(/Segunda chamada está disponível nos planos Professor e Escola/)).toBeVisible();
  // Word também bloqueado
  await page.goto(`/app/provas/${id}/previa`);
  await expect(page.getByRole("link", { name: /Word editável do aluno \(plano Professor\)/ })).toBeVisible();

  // SA-09: contratar (uma vez), repetir, cancelar e reativar sem duplicar cobrança
  await page.goto("/app/plano");
  await page.getByRole("button", { name: "Contratar plano Professor" }).click();
  await expect(page.getByRole("heading", { name: "Plano atual: Professor" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Contratar plano Professor" })).toHaveCount(0); // repetir não duplica
  await expect(page.locator("table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Cancelar assinatura" }).click();
  await expect(page.getByText(/cancelamento efetivo em/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plano atual: Professor" })).toBeVisible(); // acesso até o fim do ciclo
  await page.getByRole("button", { name: "Reativar assinatura" }).click();
  await expect(page.getByRole("button", { name: "Cancelar assinatura" })).toBeVisible();
  await expect(page.locator("table tbody tr")).toHaveCount(1);

  // AV-07: cartões por foto no plano Professor
  await page.goto(appUrl);
  await page.getByLabel("Fotos dos cartões").setInputFiles({ name: "c1.png", mimeType: "image/png", buffer: png() });
  await page.getByRole("button", { name: "Enviar para conferência" }).click();
  await expect(page.getByText(/1 foto\(s\) enviada\(s\) para conferência/)).toBeVisible();
  await page.getByLabel("Fotos dos cartões").setInputFiles({ name: "c1-copia.png", mimeType: "image/png", buffer: png() });
  await page.getByRole("button", { name: "Enviar para conferência" }).click();
  await expect(page.getByText(/1 repetida\(s\) ignorada\(s\)/)).toBeVisible();
  // código de outra versão é recusado e nada é contabilizado
  const sheet = page.locator("div.grid", { has: page.locator("img[alt*='cartão']") }).first();
  await sheet.getByLabel("Aluno").selectOption({ label: "Cris Melo" });
  await sheet.getByLabel(/Código impresso/).fill("ZZZZZZZZ-V9");
  await sheet.getByRole("button", { name: "Confirmar cartão" }).click();
  await expect(page.getByText(/não corresponde a esta aplicação\/versão/)).toBeVisible();
  // leitura incerta é conferida lado a lado; confirmar grava respostas
  await sheet.getByLabel(/Código impresso/).fill("");
  for (let q = 1; q <= 5; q++) await sheet.locator(`input[name=a${q}]`).fill(keys[q - 1]);
  await sheet.getByRole("button", { name: "Confirmar cartão" }).click();
  await expect(page.getByText(/1 confirmado\(s\) · 0 a conferir/)).toBeVisible({ timeout: 30_000 });
  await page.goto(appUrl);
  await expect(page.locator("tr", { hasText: "Cris Melo" }).first().locator("td").last()).toHaveText("10", { timeout: 30_000 });
  // novo envio do mesmo aluno substitui sem duplicar consumo
  await page.getByLabel("Fotos dos cartões").setInputFiles({ name: "c2.png", mimeType: "image/png", buffer: png("segunda-via") });
  await page.getByRole("button", { name: "Enviar para conferência" }).click();
  const sheet2 = page.locator("div.grid", { has: page.locator("img[alt*='cartão']") }).first();
  await sheet2.getByLabel("Aluno").selectOption({ label: "Cris Melo" });
  for (let q = 1; q <= 5; q++) await sheet2.locator(`input[name=a${q}]`).fill(keys[q - 1]);
  await sheet2.getByRole("button", { name: "Confirmar cartão" }).click();
  await expect(page.getByText(/1 confirmado\(s\) · 0 a conferir · 1 descartado/)).toBeVisible({ timeout: 30_000 });
  await page.goto("/app/plano");
  await expect(page.getByText("1 / 350")).toBeVisible(); // um cartão distinto conta uma vez

  // AV-06: segunda chamada com itens distintos; editar depois de aplicada cria nova versão
  await page.goto(`/app/provas/${id}/aplicacao`);
  await page.getByRole("button", { name: "Criar segunda chamada" }).click();
  await page.waitForURL(/\/app\/provas\/[0-9a-f-]{36}\?achou/);
  await expect(page.getByRole("heading", { name: /2ª chamada/ })).toBeVisible();
  await expect(page.getByText(/Comparação com a prova original/)).toBeVisible();
  const second = await statements(page);
  expect(second.length).toBeGreaterThan(0);
  for (const s of second) expect(originalStatements).not.toContain(s);

  // versão: remover item da original e aplicar de novo → v2; a aplicação antiga continua v1
  await page.goto(`/app/provas/${id}`);
  page.once("dialog", (d) => d.accept());
  await page.locator("article[aria-label='Questão 5']").getByRole("button", { name: "Remover" }).click();
  await expect(page.locator("article[aria-label^='Questão']")).toHaveCount(4);
  await page.goto(`/app/provas/${id}/aplicacao`);
  await page.getByRole("button", { name: /Confirmar aplicação/ }).click();
  await page.waitForURL(/\/correcao\?app=/);
  await page.goto(`/app/provas/${id}/aplicacao`);
  const versions = await page.locator("table tbody tr td:nth-child(3)").allTextContents();
  expect(versions.join(" ")).toMatch(/v1/);
  expect(versions.join(" ")).toMatch(/v2/);
});

test("SA-09: cota de 3 montagens no plano gratuito; reabrir/salvar não consome; manual continua", async ({ page }) => {
  test.setTimeout(240_000);
  await signup(page);
  const classId = await createClass(page, "7º A");
  const ids: string[] = [];
  for (let i = 1; i <= 3; i++) ids.push(await exam(page, classId, 4, `Prova ${i}`));
  // buscar de novo na mesma prova não consome outra montagem
  await page.goto(`/app/provas/${ids[0]}/escopo`);
  await page.getByRole("button", { name: "Buscar questões" }).click();
  await page.waitForURL(new RegExp(`/app/provas/${ids[0]}\\?`));
  await expect(page.locator("article[aria-label^='Questão']").first()).toBeVisible();
  // 4ª prova: limite atingido, com data de renovação
  await page.goto(`/app/provas/nova?turma=${classId}`);
  await page.getByLabel("Título da prova").fill("Prova 4");
  await page.getByLabel("O que a turma estudou?").fill(TEXT);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForURL(/\/escopo$/);
  const id4 = page.url().split("/").slice(-2)[0];
  await page.getByRole("button", { name: "Buscar questões" }).click();
  await expect(page.getByText(/Limite de 3 montagens assistidas do ciclo atingido/)).toBeVisible();
  // manual segue disponível
  await page.goto(`/app/banco?q=camisa&add=${id4}`);
  await page.getByRole("button", { name: "Adicionar à prova" }).first().click();
  await page.waitForURL(new RegExp(`/app/provas/${id4}`));
  await expect(page.locator("article[aria-label='Questão 1']")).toBeVisible();
  // PDF e dados continuam exportáveis
  await page.goto(`/app/provas/${id4}/previa`);
  await expect(page.getByRole("link", { name: "Baixar PDF do aluno" })).toBeVisible();
  // limite de turmas (1 no gratuito)
  await page.goto("/app/turmas/nova");
  await page.getByLabel("Identificação da turma").fill("7º B");
  await page.getByRole("button", { name: "Criar turma" }).click();
  await expect(page.getByText(/permite 1 turma\(s\) ativa\(s\)/)).toBeVisible();
});
