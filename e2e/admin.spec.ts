import { test, expect } from "@playwright/test";
import { signup, createClass, uid, sql } from "./helpers";

test("AV-03 e operação interna: importar com duplicatas, retificar gabarito com aviso, ocorrências e moderação", async ({ page, browser }) => {
  test.setTimeout(300_000);
  // professor com prova montada
  const teacher = await browser.newContext();
  const tp = await teacher.newPage();
  const tEmail = await signup(tp, { name: "Professora Impactada" });
  const classId = await createClass(tp, "8º A");
  await tp.goto(`/app/provas/nova?turma=${classId}`);
  await tp.getByLabel("O que a turma estudou?").fill("Ensinei porcentagem simples.");
  await tp.getByRole("button", { name: "Continuar" }).click();
  await tp.waitForURL(/\/escopo$/);
  const aid = tp.url().split("/").slice(-2)[0];
  await tp.getByRole("button", { name: "Buscar questões" }).click();
  await tp.waitForURL(new RegExp(`/app/provas/${aid}\\?`));

  // usuário comum não acessa a área interna
  await tp.goto("/admin");
  await expect(tp).toHaveURL(/\/app$/);

  // equipe interna
  const sEmail = await signup(page, { name: "Curadoria" });
  await sql`update users set is_staff = true where email = ${sEmail}`;
  await page.goto("/admin?tab=acervo");
  await expect(page.getByRole("heading", { name: "Operação interna" })).toBeVisible();

  // importação em lote: duplicata reconhecida por (instituição, prova, ano, caderno, número); itens entram em curadoria
  const tag = uid();
  const batch = [
    { institution: "Fuvest", exam: `Fuvest ${tag}`, year: 2020, booklet: "A", number: 12, title: `Item importado ${tag}`, statement: "Enunciado", alternatives: [{ key: "A", text: "x" }, { key: "B", text: "y" }], answer: "A", assessed: ["fracoes"] },
    { institution: "Fuvest", exam: `Fuvest ${tag}`, year: 2020, booklet: "A", number: 12, title: `Item importado ${tag} (dup)`, assessed: ["fracoes"] },
    { institution: "Fuvest", exam: `Fuvest ${tag}`, year: 2020, booklet: "B", number: 12, title: `Item importado ${tag} caderno B`, assessed: ["fracoes"] },
  ];
  await page.locator("textarea[name=json]").fill(JSON.stringify(batch));
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText(/2 item\(ns\) importado\(s\) em curadoria; 1 duplicata\(s\) reconhecida\(s\)/)).toBeVisible();
  // tópico inválido é rejeitado
  await page.locator("textarea[name=json]").fill(JSON.stringify([{ institution: "X", exam: "Y", year: 2020, title: "t", assessed: ["nao-existe"] }]));
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText(/tópico desconhecido/)).toBeVisible();
  // item em curadoria não pode ser incluído na prova (banco mostra o motivo)
  await tp.goto(`/app/banco?q=${tag}`);
  await expect(tp.getByText(new RegExp(`Item importado ${tag}`)).first()).toBeVisible();
  await expect(tp.getByText(/Não pode ser incluída: Questão não liberada/).first()).toBeVisible();
  await expect(tp.getByRole("button", { name: "Adicionar à prova" })).toHaveCount(0);

  // liberar sem licença registrada é recusado
  await page.goto("/admin?tab=acervo&status=curation");
  await page.locator("li.card", { hasText: `Item importado ${tag}` }).first().getByRole("button", { name: "→ Liberado" }).click();
  await page.waitForTimeout(1500);
  const st = await sql`select status from questions where title = ${`Item importado ${tag}`}`;
  expect(st[0].status).toBe("curation");

  // denúncia do professor chega às ocorrências
  const used = await sql`select q.id, q.title, q.answer from assessment_items ai join questions q on q.id = ai.question_id where ai.assessment_id = ${aid} order by ai.position limit 1`;
  const qTitle = used[0].title as string; const oldAnswer = used[0].answer as string;
  await tp.goto(`/app/banco?q=${encodeURIComponent(qTitle)}`);
  await tp.locator("li.card", { hasText: qTitle }).first().getByRole("button", { name: "Denunciar erro ou direito autoral" }).click();
  await tp.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(tp.getByText("Obrigado! A curadoria vai analisar.")).toBeVisible();
  await page.goto("/admin?tab=ocorrencias");
  await expect(page.getByText(qTitle).first()).toBeVisible();

  // retificar gabarito: registra alteração e avisa quem usa
  const newAnswer = oldAnswer === "A" ? "B" : "A";
  await page.goto("/admin?tab=acervo");
  const card = page.locator("li.card", { hasText: qTitle }).first();
  await card.getByText("Retificar gabarito").click();
  await card.getByLabel("Nova resposta").fill(newAnswer);
  await card.getByLabel("Evidência / motivo").fill("Gabarito oficial retificado pela banca");
  await card.getByRole("button", { name: "Retificar e avisar" }).click();
  await expect(page.getByText(/Gabarito retificado\. \d+ avaliação\(ões\) afetada\(s\)/)).toBeVisible();
  await tp.goto("/app/conta");
  await expect(tp.getByText("Gabarito retificado em uma questão da sua prova").first()).toBeVisible();
  // restaura o gabarito original para não afetar outros testes
  await page.goto("/admin?tab=acervo");
  const card2 = page.locator("li.card", { hasText: qTitle }).first();
  await card2.getByText("Retificar gabarito").click();
  await card2.getByLabel("Nova resposta").fill(oldAnswer);
  await card2.getByLabel("Evidência / motivo").fill("Restaurando gabarito original (teste)");
  await card2.getByRole("button", { name: "Retificar e avisar" }).click();
  await expect(page.getByText(/Gabarito retificado/)).toBeVisible();

  // moderação: publicação denunciada é ocultada; bloqueio de autor
  await tp.goto("/app/comunidade");
  await tp.getByLabel("Título", { exact: true }).fill(`Atividade ${tag}`);
  await tp.getByLabel("Mensagem").fill("Uma atividade interessante sobre frações.");
  await tp.getByRole("button", { name: "Publicar" }).click();
  await tp.waitForURL(/\/app\/comunidade\/[0-9a-f-]{36}$/);
  const postUrl = tp.url();
  const reporter = await browser.newContext();
  const rp = await reporter.newPage();
  await signup(rp, { name: "Denunciante" });
  await rp.goto(postUrl);
  await rp.getByText("Denunciar").first().click();
  await rp.getByLabel("Motivo").first().selectOption("dados_alunos");
  await rp.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(rp.getByText("Denúncia enviada à moderação. Obrigado.")).toBeVisible();
  await page.goto("/admin?tab=moderacao");
  const flag = page.locator("li", { hasText: `Atividade ${tag}` }).first();
  await flag.getByRole("button", { name: "Ocultar e bloquear autor" }).click();
  await expect(page.locator("li", { hasText: `Atividade ${tag}` })).toHaveCount(0); // sai da fila de abertas
  await rp.goto(postUrl);
  await expect(rp.getByText("Página não encontrada")).toBeVisible(); // oculta
  await tp.goto("/app/comunidade");
  await tp.getByLabel("Título", { exact: true }).fill("Outra publicação");
  await tp.getByLabel("Mensagem").fill("Tentando publicar bloqueada.");
  await tp.getByRole("button", { name: "Publicar" }).click();
  await expect(tp.getByText(/impedida de publicar/)).toBeVisible();
  // recurso aceito: reverte bloqueio
  await page.goto("/admin?tab=moderacao");
  await page.getByRole("button", { name: "Reverter (recurso aceito)" }).first().click();

  // abas restantes carregam
  for (const t of ["assinaturas", "suporte", "piloto", "saude"]) {
    await page.goto(`/admin?tab=${t}`);
    await expect(page.getByRole("heading", { name: "Operação interna" })).toBeVisible();
  }
  await page.goto("/admin?tab=piloto");
  await expect(page.getByText(/Tempo de preparação/)).toBeVisible();
  void tEmail;
});
