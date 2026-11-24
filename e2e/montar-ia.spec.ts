import { test, expect as baseExpect } from "@playwright/test";
import { signup, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 15000 });
// Precisa do servidor falso de IA: node e2e/mock-llm.mjs, e o app com AI_PROVIDER=nvidia NVIDIA_API_KEY=x NVIDIA_URL=http://127.0.0.1:9999/v1
test.skip(!process.env.E2E_AI_MOCK, "defina E2E_AI_MOCK=1 com o servidor falso de IA");

test("IA escolhe as melhores do banco e, se habilitado, cria questões novas (marcadas para conferir)", async ({ page: t }) => {
  test.setTimeout(120_000);
  const email = await signup(t);
  // sem a permissão, criar questões fica desligado e o formulário explica como ativar
  await t.goto("/app/provas/montar");
  await expect(t.locator('input[name="ia"][value="completar"]')).toBeDisabled();
  await expect(t.locator('input[name="ia"][value="novas"]')).toBeDisabled();
  await expect(t.getByText(/ative a permissão em/)).toBeVisible();
  await sql`update users set prefs = prefs || '{"gizCriaQuestoes": true}'::jsonb where email = ${email}`;
  const montar = async (ia: string, count: string) => {
    await t.goto("/app/provas/montar");
    await t.getByLabel("Temas da prova").fill("Machado de Assis");
    await t.getByLabel("Disciplina").selectOption("lingua-portuguesa");
    await t.getByLabel("Série (define a dificuldade)").selectOption("em2");
    await t.getByLabel("Quantas questões").fill(count);
    await t.locator(`input[name="ia"][value="${ia}"]`).check();
    await t.getByRole("button", { name: "Montar prova" }).click();
    await t.waitForURL(/\/editar/, { timeout: 60_000 });
  };
  const secoes = t.locator("section[aria-label^='Questão ']");

  // 1) só banco: a IA escolhe entre as candidatas (mais candidatas que o pedido)
  await montar("banco", "4");
  await expect(secoes).toHaveCount(4);
  await expect(t.getByText(/escolhidas pela GizIA/)).toBeVisible();
  await expect(t.getByTestId("badge-ia")).toHaveCount(0);

  // 2) completar: pede mais do que o banco tem → a IA cria o que falta
  await montar("completar", "12");
  const n = await secoes.count();
  expect(n).toBeGreaterThan(8);
  expect(await t.getByTestId("badge-ia").count()).toBeGreaterThan(0);
  await expect(t.getByTestId("badge-ia").first()).toContainText("confira antes de aplicar");
  await expect(t.getByText(/criada\(s\) pela GizIA/)).toBeVisible();

  // 3) todas novas
  await montar("novas", "3");
  await expect(secoes).toHaveCount(3);
  await expect(t.getByTestId("badge-ia")).toHaveCount(3);

  // no banco, a questão criada aparece com tema e aviso, e só para esta escola
  await t.goto("/app/banco?q=Dom+Casmurro+principal+d%C3%BAvida");
  await expect(t.getByTestId("questao-meta").filter({ hasText: "Criada pela GizIA" }).first()).toBeVisible();
  const outro = await t.context().browser()!.newContext(); const p2 = await outro.newPage();
  await signup(p2);
  await p2.goto("/app/banco?q=Dom+Casmurro+principal+d%C3%BAvida");
  await expect(p2.getByTestId("questao-meta").filter({ hasText: "Criada pela GizIA" })).toHaveCount(0);
});

test("Banco mostra tema e série indicada e filtra por eles", async ({ page: t }) => {
  await signup(t);
  await t.goto("/app/banco?q=Machado+de+Assis");
  await expect(t.getByTestId("questao-meta").first()).toContainText("Tema:");
  await expect(t.getByTestId("questao-meta").first()).toContainText("Indicada para:");
  await t.goto("/app/banco?tema=Machado+de+Assis+e+Realismo&serie=em2");
  expect(await t.getByTestId("resultado-questao").count()).toBeGreaterThan(0);
});

test("Editor: botão '+ Questão com a GizIA' pede permissão e, liberada, cria questões marcadas", async ({ page: t }) => {
  test.setTimeout(120_000);
  const email = await signup(t);
  await t.goto("/app/provas/montar");
  await t.getByLabel("Temas da prova").fill("Machado de Assis");
  await t.getByLabel("Disciplina").selectOption("lingua-portuguesa");
  await t.getByLabel("Quantas questões").fill("2");
  await t.getByRole("button", { name: "Montar prova" }).click();
  await t.waitForURL(/\/editar/, { timeout: 60_000 });
  const secoes = t.locator("section[aria-label^='Questão ']");
  const antes = await secoes.count();
  // sem permissão
  await t.getByTestId("questao-giz").click();
  const dlg = t.getByRole("dialog", { name: "Criar questões com a GizIA" });
  await expect(dlg.getByText(/está desligada/)).toBeVisible();
  await expect(dlg.getByRole("link", { name: "Ativar em Minha conta" })).toHaveAttribute("href", "/app/conta");
  await t.keyboard.press("Escape");
  // com permissão
  await sql`update users set prefs = prefs || '{"gizCriaQuestoes": true}'::jsonb where email = ${email}`;
  await t.reload();
  await t.getByTestId("questao-giz").click();
  await dlg.getByLabel("Sobre qual tema?").fill("Dom Casmurro");
  await dlg.getByLabel("Quantas questões").selectOption("2");
  await dlg.getByRole("button", { name: "Criar questões" }).click();
  await expect(dlg).toBeHidden();
  await expect(secoes).toHaveCount(antes + 2);
  await expect(t.getByTestId("badge-ia")).toHaveCount(2);
  await expect(t.getByTestId("badge-ia").first()).toContainText("Criada pela GizIA");
});
