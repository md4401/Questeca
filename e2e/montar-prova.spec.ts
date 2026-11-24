import { test, expect as baseExpect } from "@playwright/test";
import { signup } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 12000 });

test("Montar prova por temas e série, e editar tudo no editor", async ({ page: t }) => {
  test.setTimeout(120_000);
  await signup(t);
  await t.goto("/app/provas/montar");
  await t.getByLabel("Temas da prova").fill("Machado de Assis");
  await t.getByLabel("Disciplina").selectOption("lingua-portuguesa");
  await t.getByLabel("Série (define a dificuldade)").selectOption("em2");
  await t.getByLabel("Quantas questões").fill("3");
  await t.getByRole("button", { name: "Montar prova" }).click();
  await t.waitForURL(/\/editar/, { timeout: 60_000 });
  const secoes = t.locator("section[aria-label^='Questão ']");
  await expect(secoes.first()).toBeVisible();
  const antes = await secoes.count();
  expect(antes).toBeGreaterThanOrEqual(1);

  // edita o enunciado, adiciona questão nova própria e remove uma
  const enun = t.getByRole("textbox", { name: "Enunciado da questão 1" });
  await enun.click();
  await t.keyboard.press("Control+End");
  await t.keyboard.type(" EDITADO-NO-EDITOR");
  await t.locator("#blank-ans").selectOption("C");
  await t.getByRole("button", { name: "+ Questão nova" }).click();
  await expect(secoes).toHaveCount(antes + 1);
  await expect(t.getByRole("textbox", { name: "Enunciado da questão 1" })).toContainText("EDITADO-NO-EDITOR");
  await expect(t.getByRole("textbox", { name: `Enunciado da questão ${antes + 1}` })).toContainText("Escreva aqui o enunciado");
  // sobe a questão nova e depois a remove
  if (antes >= 1) {
    await t.getByRole("button", { name: `Subir a questão ${antes + 1}` }).click();
    await expect(t.getByRole("textbox", { name: `Enunciado da questão ${antes}` })).toContainText("Escreva aqui o enunciado");
  }
  t.once("dialog", (d) => d.accept());
  await t.getByRole("button", { name: `Remover a questão ${antes}` }).click();
  await expect(secoes).toHaveCount(antes);
  // a edição feita no enunciado sobreviveu às ações estruturais
  await expect(t.getByRole("textbox", { name: "Enunciado da questão 1" })).toContainText("EDITADO-NO-EDITOR");
});
