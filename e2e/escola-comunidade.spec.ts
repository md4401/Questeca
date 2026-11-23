import { test, expect, request as pwRequest, type Page, type BrowserContext } from "@playwright/test";
import { signup, login, createClass, addStudents, uid, sql } from "./helpers";

async function authed(context: BrowserContext) {
  const cookies = await context.cookies();
  return pwRequest.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") } });
}

async function inviteLink(page: Page, email: string, role: "teacher" | "coordinator" | "admin" = "teacher") {
  await page.goto("/app/escola");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Papel").selectOption(role);
  await page.getByRole("button", { name: "Enviar convite" }).click();
  const msg = page.getByText(/copie e envie este link/);
  await expect(msg).toBeVisible();
  const txt = (await msg.textContent())!;
  return txt.match(/https?:\/\/\S+\/convite\/\S+/)![0].replace("http://localhost:3100", "");
}

async function joinViaInvite(browser: import("@playwright/test").Browser, email: string, link: string, name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(link);
  await page.getByRole("link", { name: "Criar conta e aceitar" }).click();
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByLabel("Senha", { exact: true }).fill("Senha1234");
  await page.getByLabel(/Li e aceito/).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL(/\/convite\//);
  await page.getByRole("button", { name: "Aceitar convite" }).click();
  await page.waitForURL(/\/(app|cadastro)/);
  return { ctx, page };
}

test("SA-02: convite, trocar de escola, isolamento entre escolas e turmas; SA-08: comunidade", async ({ page, browser, context }) => {
  test.setTimeout(420_000);
  // Escola A (admin cria o ambiente institucional)
  await signup(page, { name: "Gestora A" });
  await page.goto("/app/escola");
  await page.getByLabel("Nome da escola", { exact: true }).last().fill("Colégio A");
  await page.getByRole("button", { name: "Criar ambiente da escola" }).click();
  await expect(page.getByRole("heading", { name: "Colégio A" })).toBeVisible();
  const classA = await createClass(page, "9º A");
  await addStudents(page, classA, "Fulano de Tal;5001");

  // convite de professor sem turma + convite de coordenação
  const emailB = `profb-${uid()}@test.questeca.dev`;
  const emailC = `coord-${uid()}@test.questeca.dev`;
  const linkB = await inviteLink(page, emailB, "teacher");
  const linkC = await inviteLink(page, emailC, "coordinator");
  const linkRev = await inviteLink(page, `rev-${uid()}@test.questeca.dev`, "teacher");

  // revogar convite pendente → link mostra revogado
  await page.goto("/app/escola");
  await page.locator("tr", { hasText: "rev-" }).getByRole("button", { name: "Revogar" }).click();
  await expect(page.locator("tr", { hasText: "rev-" }).locator(".badge", { hasText: "revogado" })).toBeVisible();
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  await ap.goto(linkRev);
  await expect(ap.getByText(/foi revogado pela escola/)).toBeVisible();
  await anon.close();

  // convite só vale para o e-mail convidado
  const wrong = await browser.newContext();
  const wp = await wrong.newPage();
  await signup(wp, { name: "Intrusa" });
  await wp.goto(linkB);
  await wp.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(wp.getByText(/foi enviado para/)).toBeVisible();
  await wrong.close();

  // professor B aceita; só vê a turma depois de atribuída
  const b = await joinViaInvite(browser, emailB, linkB, "Professor B");
  await b.page.goto(`/app/turmas/${classA}`);
  await expect(b.page.getByText("Página não encontrada")).toBeVisible(); // sem atribuição: nada de acesso
  await page.goto("/app/escola");
  await page.locator("tr", { hasText: emailB }).getByRole("button", { name: /9º A/ }).click();
  await expect(page.locator("tr", { hasText: emailB }).getByRole("button", { name: /9º A ✓/ })).toBeVisible();
  await b.page.goto(`/app/turmas/${classA}`);
  await expect(b.page.getByRole("heading", { name: "9º A" })).toBeVisible();

  // Escola B (outra pessoa) não acessa a turma do Colégio A por link direto
  const other = await browser.newContext();
  const op = await other.newPage();
  await signup(op, { name: "Outra Escola" });
  await op.goto(`/app/turmas/${classA}`);
  await expect(op.getByText("Página não encontrada")).toBeVisible();
  const oapi = await authed(other);
  expect((await oapi.get(`/api/export/notas?turma=${classA}&periodo=1`)).status()).toBe(404);

  // trocar entre contextos: pessoal e Colégio A, com listas distintas
  await b.page.goto("/app/turmas");
  await expect(b.page.getByRole("link", { name: "9º A", exact: true })).toBeVisible();
  await b.page.locator("#org").selectOption({ label: "Espaço pessoal (pessoal)" });
  await b.page.getByRole("button", { name: "Trocar" }).click();
  await b.page.waitForURL(/\/app$/);
  await b.page.goto("/app/turmas");
  await expect(b.page.getByRole("link", { name: "9º A", exact: true })).toHaveCount(0);

  // SA-08: comunidade — grupo escolar, anexo restrito, bloqueio de dados de estudantes
  await b.page.locator("#org").selectOption({ label: "Colégio A" });
  await b.page.getByRole("button", { name: "Trocar" }).click();
  await b.page.waitForURL(/\/app$/);
  await b.page.goto("/app/comunidade");
  await b.page.getByLabel("Título", { exact: true }).fill("Aluno Fulano de Tal precisa de ajuda");
  await b.page.getByLabel("Mensagem").fill("O aluno Fulano de Tal foi mal na prova.");
  await b.page.getByRole("button", { name: "Publicar" }).click();
  await expect(b.page.getByText(/cita o nome de um estudante/)).toBeVisible();
  await b.page.getByLabel("Título", { exact: true }).fill("Nota do aluno");
  await b.page.getByLabel("Mensagem").fill("Segue a nota do aluno da turma.");
  await b.page.getByRole("button", { name: "Publicar" }).click();
  await expect(b.page.getByText(/Não publique notas/)).toBeVisible();

  await b.page.getByLabel("Título", { exact: true }).fill("Lista de exercícios de frações");
  await b.page.getByLabel("Mensagem").fill("Compartilho minha lista com a equipe da escola.");
  await b.page.getByLabel(/Somente colegas de Colégio A/).check();
  await b.page.getByLabel(/Anexo \(opcional/).setInputFiles({ name: "lista.txt", mimeType: "text/plain", buffer: Buffer.from("exercicios") });
  await b.page.getByRole("button", { name: "Publicar" }).click();
  await expect(b.page.getByText(/Confirme que o anexo não contém/)).toBeVisible();
  await b.page.getByLabel(/Confirmo que o anexo/).check();
  await b.page.getByRole("button", { name: "Publicar" }).click();
  await b.page.waitForURL(/\/app\/comunidade\/[0-9a-f-]{36}$/);
  const postId = b.page.url().split("/").pop()!;
  await expect(b.page.getByText("Privado: Colégio A")).toBeVisible();
  const att = b.page.getByRole("link", { name: "lista.txt" });
  await expect(att).toBeVisible();

  // membro da escola abre o anexo; outra escola não vê a publicação nem o anexo
  const memberApi = await authed(await (async () => { return page.context(); })());
  expect((await memberApi.get(`/api/post-file/${postId}`)).status()).toBe(200);
  expect((await oapi.get(`/api/post-file/${postId}`)).status()).toBe(404);
  await op.goto(`/app/comunidade/${postId}`);
  await expect(op.getByText("Página não encontrada")).toBeVisible();

  // denúncia chega à moderação; mural geral aceita publicação sem dados de alunos
  await b.page.getByText("Denunciar").first().click();
  await b.page.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(b.page.getByText("Denúncia enviada à moderação. Obrigado.")).toBeVisible();

  // SA-07: documentos — coordenação revisa; fatos sem evidência ficam em aberto
  const c = await joinViaInvite(browser, emailC, linkC, "Coordenadora C");
  await b.page.goto(`/app/turmas/${classA}`);
  await b.page.getByLabel("O que aconteceu na aula?").fill("Resolvemos problemas de porcentagem.");
  await b.page.getByLabel("Porcentagem simples").check();
  await b.page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(b.page.getByText(/Aula registrada/)).toBeVisible();
  await b.page.goto("/app/documentos");
  await b.page.getByLabel("Documento").selectOption("diario");
  await b.page.getByRole("button", { name: "Gerar rascunho" }).click();
  await b.page.waitForURL(/\/app\/documentos\/[0-9a-f-]{36}$/);
  const docUrl = b.page.url();
  await expect(b.page.getByRole("textbox", { name: "Conteúdo" })).toHaveValue(/Resolvemos problemas de porcentagem/);
  await expect(b.page.getByText("Evidências usadas")).toBeVisible();
  // relatório individual: sem observações/notas → pontos em aberto e envio bloqueado
  await b.page.goto("/app/documentos");
  await b.page.getByLabel("Documento").selectOption("relatorio");
  await b.page.getByLabel(/Aluno \(relatório/).selectOption({ label: "Fulano de Tal" });
  await b.page.getByRole("button", { name: "Gerar rascunho" }).click();
  await b.page.waitForURL(/\/app\/documentos\/[0-9a-f-]{36}$/);
  await expect(b.page.getByText(/Sem observações datadas deste aluno/)).toBeVisible();
  await expect(b.page.getByRole("button", { name: "Enviar para revisão" })).toBeDisabled();
  // diário não tem lacunas: envia para revisão institucional
  await b.page.goto(docUrl);
  await b.page.getByRole("button", { name: "Enviar para revisão" }).click();
  await expect(b.page.getByText("Em revisão institucional").first()).toBeVisible();
  // coordenação devolve com observações, depois aprova
  await c.page.goto(docUrl);
  await c.page.getByLabel("Observações").fill("Faltou detalhar a atividade.");
  await c.page.getByRole("button", { name: "Devolver" }).click();
  await expect(c.page.locator(".badge", { hasText: "Devolvido com observações" })).toBeVisible();
  await b.page.goto(docUrl);
  await expect(b.page.getByText("Faltou detalhar a atividade.")).toBeVisible();
  await b.page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(b.page.getByText("Rascunho salvo.")).toBeVisible();
  await b.page.getByRole("button", { name: "Enviar para revisão" }).click();
  await expect(b.page.getByText("Em revisão institucional").first()).toBeVisible();
  await c.page.goto(docUrl);
  await c.page.getByRole("button", { name: "Aprovar versão final" }).click();
  await expect(c.page.locator(".badge", { hasText: "Versão final aprovada" })).toBeVisible();
  const bApi = await authed(b.ctx);
  const pdf = await bApi.get(`/api/export/documento?id=${docUrl.split("/").pop()}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("pdf");
  // o professor não revisa o próprio documento
  expect((await b.page.getByRole("button", { name: "Aprovar versão final" }).count())).toBe(0);
  void login; void sql; void context;
});
