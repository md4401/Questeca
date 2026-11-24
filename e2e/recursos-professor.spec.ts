import { test, expect } from "@playwright/test";
import { signup, createClass, addStudents, sql } from "./helpers";

test("Quiz ao vivo: professor cria, aluno entra por código, responde e vê o resultado", async ({ page, browser }) => {
  await signup(page);
  await page.goto("/app/quiz/novo");
  await page.getByLabel("Nome do quiz").fill("Tabuada");
  await page.getByLabel("Perguntas", { exact: true }).fill("Quanto é 7 × 8? [10s]\n- 54\n* 56\n- 58\n\nCapital do Brasil?\n- São Paulo\n* Brasília");
  await page.getByRole("button", { name: "Salvar quiz" }).click();
  await expect(page.getByRole("heading", { name: "Tabuada" })).toBeVisible();
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
  await expect(aluno.getByText(/\+9\d\d pontos|\+1000 pontos/)).toBeVisible();
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
  await expect(page.getByTestId("biblioteca-provas")).toBeVisible();
  await expect(page.getByTestId("biblioteca-apresentacoes")).toBeVisible();
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
