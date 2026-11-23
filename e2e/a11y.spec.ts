import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signup, createClass, addStudents } from "./helpers";

async function audit(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(`A11Y ${name}:`, bad.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target?.join(" ")}`).join(" | "));
  expect(bad, `${name}: ${bad.map((v) => v.id).join(", ")}`).toEqual([]);
}

test("SA-10: acessibilidade (axe WCAG 2.2 AA) nas telas principais e navegação por teclado", async ({ page }) => {
  test.setTimeout(300_000);
  for (const p of ["/", "/planos", "/entrar", "/criar-conta", "/escolas", "/ajuda", "/termos"]) { await page.goto(p); await audit(page, p); }
  await signup(page);
  const classId = await createClass(page, "9º B");
  await addStudents(page, classId, "Ana Souza;1\nBruno Dias;2");
  await audit(page, "turma");
  await page.goto("/app"); await audit(page, "/app");
  await page.goto("/app/turmas/nova"); await audit(page, "turma-nova");
  await page.goto(`/app/turmas/${classId}/alunos`); await audit(page, "alunos");
  await page.goto(`/app/turmas/${classId}/notas`);
  await page.getByLabel("Atividade", { exact: true }).fill("Prova");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByLabel("Ana Souza — Prova")).toBeVisible();
  await audit(page, "notas");
  await page.goto(`/app/provas/nova?turma=${classId}`);
  await page.getByLabel("O que a turma estudou?").fill("Ensinei porcentagem simples e descontos sucessivos.");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForURL(/\/escopo$/);
  await audit(page, "escopo");
  const id = page.url().split("/").slice(-2)[0];
  await page.getByRole("button", { name: "Buscar questões" }).click();
  await page.waitForURL(new RegExp(`/app/provas/${id}\\?`));
  await audit(page, "editor");
  await page.goto("/app/banco"); await audit(page, "banco");
  await page.goto("/app/comunidade"); await audit(page, "comunidade");
  await page.goto("/app/plano"); await audit(page, "plano");
  await page.goto("/app/conta"); await audit(page, "conta");
  await page.goto("/app/documentos"); await audit(page, "documentos");

  // teclado: "pular para o conteúdo" é o primeiro foco e o foco é visível
  await page.goto("/app");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  // reordenação possível por botões (sem arrastar)
  await page.goto(`/app/provas/${id}`);
  await expect(page.getByRole("button", { name: /Mover questão 2 para cima/ })).toBeVisible();
  // fonte maior na prévia
  await page.goto(`/app/provas/${id}/previa?fonte=grande`);
  await expect(page.getByText("Fonte maior: ligada")).toBeVisible();
});
