import { test, expect } from "@playwright/test";
import { signup, createClass, addStudents, sql } from "./helpers";

test("Quiz ao vivo: professor cria, aluno entra por código, responde e vê o resultado", async ({ page, browser }) => {
  await signup(page);
  await page.goto("/app/quiz/novo");
  await expect(page.getByTestId("criar-manual")).toBeVisible();
  await expect(page.getByText("Criar com a GizIA")).toBeVisible();
  await page.getByTestId("criar-manual").click();
  await page.getByLabel("Nome do quiz").fill("Tabuada");
  await page.getByLabel("Pergunta 1", { exact: true }).fill("Quanto é 7 × 8?");
  await page.getByLabel("Texto da opção 1 da pergunta 1").fill("54");
  await page.getByLabel("Texto da opção 2 da pergunta 1").fill("56");
  await page.getByLabel("Texto da opção 3 da pergunta 1").fill("58");
  await page.getByLabel("Marcar opção 2 como certa").click();
  await page.locator(".qb-tempo select").first().selectOption("120"); // folga para máquinas lentas
  await page.getByTestId("add-pergunta").click();
  await page.getByLabel("Pergunta 2", { exact: true }).fill("Capital do Brasil?");
  await page.getByLabel("Texto da opção 1 da pergunta 2").fill("São Paulo");
  await page.getByLabel("Texto da opção 2 da pergunta 2").fill("Brasília");
  await page.getByLabel("Marcar opção 2 como certa").last().click();
  await page.locator(".qb-tempo select").last().selectOption("120");
  await page.getByRole("button", { name: "Salvar quiz" }).click();
  await expect(page.getByRole("heading", { name: "Tabuada" })).toBeVisible();
  await expect(page.getByTestId("pergunta")).toHaveCount(2);
  await expect(page.getByLabel("Texto da opção 2 da pergunta 1")).toHaveValue("56");
  await page.getByTestId("iniciar-jogo").click();
  const code = (await page.getByTestId("codigo-jogo").textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  const aluno = await (await browser.newContext()).newPage();
  await aluno.goto("/jogar");
  await aluno.getByLabel("Código").fill(code);
  await aluno.getByLabel("Seu apelido").fill("Bia");
  await aluno.getByRole("button", { name: "Entrar" }).click();
  await expect(aluno.getByText("Você está dentro!")).toBeVisible();
  await expect(page.getByText("Bia", { exact: true })).toBeVisible({ timeout: 8000 });

  // apelido repetido é recusado
  const outro = await (await browser.newContext()).newPage();
  await outro.goto("/jogar"); await outro.getByLabel("Código").fill(code); await outro.getByLabel("Seu apelido").fill("Bia");
  await outro.getByRole("button", { name: "Entrar" }).click();
  await expect(outro.getByText(/já está em uso/)).toBeVisible();

  await page.getByTestId("comecar").click();
  await expect(aluno.getByText("Quanto é 7 × 8?")).toBeVisible({ timeout: 8000 });
  // a resposta certa NÃO pode vir no estado durante a pergunta
  const est = await aluno.evaluate(async () => { const s = JSON.parse(sessionStorage.getItem("segunda-lousa-quiz")!); return await (await fetch(`/api/quiz/estado?code=${s.code}&player=${s.player}&secret=${s.secret}`)).text(); });
  expect(est).not.toContain('"certa"');
  await aluno.getByRole("button", { name: /56/ }).click();
  await expect(aluno.getByText(/Resposta enviada/)).toBeVisible();
  await expect(page.getByText(/1\/1 responderam/)).toBeVisible({ timeout: 8000 });
  await page.getByTestId("avancar").click(); // mostrar resposta
  await expect(aluno.getByText("Acertou!")).toBeVisible({ timeout: 8000 });
  await expect(aluno.getByText(/\+\d{3,4} pontos/)).toBeVisible();
  await page.getByTestId("avancar").click(); // próxima
  await expect(aluno.getByText("Capital do Brasil?")).toBeVisible({ timeout: 8000 });
  await aluno.getByRole("button", { name: /São Paulo/ }).click();
  await page.getByTestId("avancar").click();
  await expect(aluno.getByText("Errou")).toBeVisible({ timeout: 8000 });
  await page.getByTestId("avancar").click(); // resultado final
  await expect(aluno.getByText("Fim de jogo!")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Resultado final")).toBeVisible();
});

test("Sorteio, matéria da semana pública, Meu dia, Biblioteca e filtros de ocorrências", async ({ page, browser }) => {
  await signup(page);
  const classId = await createClass(page, "9º B");
  await addStudents(page, classId, "Ana Lima\nBruno Souza\nCarla Dias\nDiego Rocha");

  await page.goto(`/app/turmas/${classId}/sorteio`);
  await page.getByTestId("sortear").click();
  await expect(page.getByTestId("sorteado")).not.toHaveText("—", { timeout: 5000 });
  await page.getByLabel("Tamanho").fill("2");
  await page.getByTestId("formar-grupos").click();
  await expect(page.getByTestId("grupos").getByText(/^Grupo \d$/)).toHaveCount(2);

  await page.goto(`/app/turmas/${classId}/semana`);
  await page.getByLabel("Conteúdo da semana").fill("Funções do 2º grau");
  await page.getByLabel("Tarefa / para casa").fill("Lista 3");
  await page.getByLabel(/Links/).fill("Vídeo | https://example.com/v\njavascript:alert(1)");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByTestId("link-publico")).toBeVisible({ timeout: 8000 });
  const path = (await page.getByTestId("link-publico").textContent())!.trim().replace(/^https?:\/\/[^/]*/, "");
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(path);
  await expect(anon.getByText("Funções do 2º grau")).toBeVisible();
  await expect(anon.getByText("Lista 3")).toBeVisible();
  await expect(anon.getByRole("link", { name: "Vídeo" })).toHaveAttribute("href", "https://example.com/v");
  await expect(anon.getByText("Ana Lima")).toHaveCount(0);
  expect((await anon.request.get("/s/tokeninvalido123")).status()).toBe(404);

  await page.goto("/app/meu-dia");
  await expect(page.getByRole("heading", { name: "Meu dia" })).toBeVisible();
  await page.goto("/app/biblioteca");
  await expect(page.getByRole("heading", { name: "Biblioteca" })).toBeVisible();
  for (const a of ["tudo", "provas", "apresentacoes", "materiais"]) await expect(page.getByTestId(`aba-${a}`)).toBeVisible();
  await page.getByTestId("aba-provas").click(); await expect(page).toHaveURL(/aba=provas/);
  await page.goto("/app/materiais"); await expect(page).toHaveURL(/\/app\/biblioteca/);

  await page.goto(`/app/turmas/${classId}/observacoes`);
  await page.getByLabel("Observação", { exact: true }).fill("Chegou atrasado e sem material");
  await page.getByLabel("Sobre").selectOption({ label: "Ana Lima" });
  await page.getByRole("button", { name: "Salvar observação" }).click();
  await expect(page.getByText("Chegou atrasado e sem material")).toBeVisible({ timeout: 8000 });
  await page.goto(`/app/turmas/${classId}/observacoes?aluno=turma`);
  await expect(page.getByText("Nada encontrado com esses filtros.")).toBeVisible();
  await page.goto(`/app/turmas/${classId}/observacoes?q=atrasado`);
  await expect(page.getByText("Chegou atrasado e sem material")).toBeVisible();
});

test("Lista A/B cria duas versões com as mesmas questões em outra ordem; Corrigir por foto valida os campos", async ({ page }) => {
  test.setTimeout(120_000);
  await signup(page);
  await page.goto("/app/provas/listas");
  await page.getByLabel("Temas").fill("Machado de Assis");
  await page.getByLabel("Questões em cada lista").fill("2");
  await page.getByRole("button", { name: "Criar listas A e B" }).click();
  await page.waitForURL(/\/app\/provas\?listas=/, { timeout: 60_000 });
  await expect(page.getByRole("link", { name: /\(versão A\)/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /\(versão B\)/ })).toBeVisible();
  const [a, b] = new URL(page.url()).searchParams.get("listas")!.split(".");
  const ids = async (id: string) => (await page.request.get(`/app/provas/${id}/editar`)).ok();
  expect(await ids(a)).toBe(true); expect(await ids(b)).toBe(true); expect(a).not.toBe(b);
  const q = async (id: string) => (await sql`select question_id from assessment_items where assessment_id = ${id} order by position`).map((r) => r.question_id as string);
  const [qa, qb] = [await q(a), await q(b)];
  expect(qa.length).toBe(2); expect([...qb].sort()).toEqual([...qa].sort()); expect(qb).not.toEqual(qa);

  await page.goto("/app/provas/corrigir-foto");
  await expect(page.getByRole("heading", { name: "Corrigir resposta por foto" })).toBeVisible();
  await page.getByLabel("Enunciado da questão").fill("Explique a Lei Áurea.");
  await page.getByLabel(/Critério/).fill("Cita 1888 e o fim da escravidão.");
  await page.getByLabel("Foto da resposta do aluno").setInputFiles({ name: "x.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await page.getByRole("button", { name: "Corrigir" }).click();
  await expect(page.getByText("Use uma foto PNG, JPG ou WebP.")).toBeVisible();
});

test("Biblioteca: Adicionar material abre em modal e fecha ao salvar", async ({ page }) => {
  await signup(page);
  await page.goto("/app/biblioteca");
  await expect(page.getByLabel("Título")).toHaveCount(0);
  await page.getByTestId("adicionar-material").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Título").fill("Apostila de funções");
  await page.getByLabel("Texto").fill("Resumo da matéria");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 8000 });
  await expect(page.getByRole("heading", { name: "Apostila de funções" })).toBeVisible();
});

test("Quiz: pergunta longa aparece inteira no construtor", async ({ page }) => {
  await signup(page);
  await page.goto("/app/quiz/novo/manual");
  await page.getByLabel("Nome do quiz").fill("Trigonometria");
  const longa = "Em um triângulo retângulo, os catetos medem 3 e 4, e a hipotenusa mede 5. Para o ângulo oposto ao cateto 3, qual é o seno?";
  await page.getByLabel("Pergunta 1", { exact: true }).fill(longa);
  for (const [n, t] of [[1, "4/5"], [2, "3/5"]] as const) await page.getByLabel(`Texto da opção ${n} da pergunta 1`).fill(t);
  await page.getByRole("button", { name: "Salvar quiz" }).click();
  await expect(page.getByTestId("iniciar-jogo")).toBeVisible();
  for (const w of [1200, 390]) {
    await page.setViewportSize({ width: w, height: 800 });
    const ok = await page.getByLabel("Pergunta 1", { exact: true }).evaluate((e: HTMLTextAreaElement) => e.scrollHeight <= e.clientHeight + 1);
    expect(ok, `largura ${w}`).toBe(true);
  }
});

test("Montar prova por tema com o banco de vestibulares: acha questões do assunto, sem lixo de extração", async ({ page }) => {
  test.setTimeout(120_000);
  const [{ n }] = await sql`select count(*)::int as n from questions where status = 'released' and origin = 'banco'`;
  test.skip(n < 500, "precisa do banco de vestibulares importado (pnpm db:importar-questoes + db:liberar)");
  await signup(page);
  for (const [tema, subject, serie] of [["funções do 2º grau", "matematica", "9"], ["cinemática", "fisica", "em1"], ["Revolução Francesa", "historia", "em2"]] as const) {
    await page.goto("/app/provas/montar");
    await page.getByLabel("Temas da prova").fill(tema);
    await page.getByLabel("Disciplina").selectOption(subject);
    await page.getByLabel(/Série/).selectOption(serie);
    await page.getByLabel("Quantas questões").fill("8");
    await page.getByRole("button", { name: /Montar/ }).last().click();
    await page.waitForURL(/\/editar/, { timeout: 60_000 });
    const id = page.url().match(/provas\/([0-9a-f-]{36})/)![1];
    const itens = await sql`select q.statement, q.alternatives from assessment_items i join questions q on q.id = i.question_id where i.assessment_id = ${id}`;
    expect(itens.length, tema).toBeGreaterThanOrEqual(3);
    for (const q of itens) expect(String(q.statement), tema).not.toMatch(/#{3,}|Concurso Vestibular|�/);
  }
});

test("Figuras das questões: aparecem na busca, no editor e vão para o PDF e o Word", async ({ page }) => {
  test.setTimeout(150_000);
  const com = await sql`select q.id, q.institution, q.exam, q.year, q.number from questions q where q.status = 'released' and exists (select 1 from question_images i where i.question_id = q.id) and q.subject = 'matematica' limit 1`;
  test.skip(!com.length, "precisa de questões com figura importadas (pnpm db:importar-figuras)");
  const q = com[0];
  await signup(page);
  // 1) o arquivo da figura exige login e é uma imagem PNG
  const [img] = await sql`select id from question_images where question_id = ${q.id} order by position limit 1`;
  const r = await page.request.get(`/api/questao-imagem/${img.id}`);
  expect(r.status()).toBe(200); expect(r.headers()["content-type"]).toBe("image/png");
  expect((await (await page.context().browser()!.newContext()).request.get(`${new URL(page.url()).origin}/api/questao-imagem/${img.id}`)).status()).toBe(401);
  // 2) monta uma prova com essa questão e confere editor + exportações
  await page.goto("/app/provas/nova");
  const t = `Figuras ${Date.now()}`;
  const [{ id: orgId }] = await sql`select active_org_id as id from sessions order by created_at desc limit 1`;
  const [prova] = await sql`insert into assessments (org_id, owner_id, title, scope, total_points, duration_min, wanted_count) values (${orgId}, (select user_id from sessions order by created_at desc limit 1), ${t}, '{"willFall":[],"prerequisite":[],"notTaught":[],"confirm":[],"sources":{}}'::jsonb, '10', 50, 1) returning id`;
  await sql`insert into assessment_items (assessment_id, question_id, position, points, reason) values (${prova.id}, ${q.id}, 1, '10', 'teste')`;
  await page.goto(`/app/provas/${prova.id}/editar`);
  await expect(page.locator(".questao-figs img").first()).toBeVisible();
  const ok = await page.locator(".questao-figs img").first().evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 20);
  expect(ok).toBe(true);
  const [{ n: bytesImg }] = await sql`select coalesce(sum(length(data)),0)::int as n from question_images where question_id = ${q.id}`;
  const [simples] = await sql`select id from questions where status = 'released' and subject = 'matematica' and not exists (select 1 from question_images i where i.question_id = questions.id) and length(statement) < 600 limit 1`;
  const [prova2] = await sql`insert into assessments (org_id, owner_id, title, scope, total_points, duration_min, wanted_count) values (${orgId}, (select user_id from sessions order by created_at desc limit 1), ${t + " B"}, '{"willFall":[],"prerequisite":[],"notTaught":[],"confirm":[],"sources":{}}'::jsonb, '10', 50, 1) returning id`;
  await sql`insert into assessment_items (assessment_id, question_id, position, points, reason) values (${prova2.id}, ${simples.id}, 1, '10', 'teste')`;
  const [a, b] = await Promise.all([prova.id, prova2.id].map(async (id) => { const r = await page.request.get(`/api/export/prova?id=${id}&tipo=aluno&rascunho=1`); expect(r.status()).toBe(200); return (await r.body()).length; }));
  expect(a, `PDF com figura (${bytesImg} bytes de imagem) deve conter a imagem`).toBeGreaterThan(b + Math.min(bytesImg, 4000) * 0.5);
});
  const sem = await page.request.get(`/api/export/prova?id=${prova.id}&tipo=aluno&rascunho=1`);
  expect(comImagem, "PDF com figura é maior que sem figura").toBeGreaterThan((await sem.body()).length + 500);
});
