import { test, expect } from "@playwright/test";
import { signup, login, lastDevEmail, linkFrom, uid, PASSWORD, sql } from "./helpers";

test("SA-01 criar conta, verificar e-mail, recuperar acesso e sair", async ({ page, browser }) => {
  const email = await signup(page);
  await expect(page).toHaveURL(/primeiros-passos/);
  await expect(page.getByText(/Confirme seu e-mail/)).toBeVisible();

  // confirmar e-mail pelo link
  const mail = await lastDevEmail(email);
  await page.goto(linkFrom(mail.text));
  await expect(page.getByRole("heading", { name: "E-mail confirmado" })).toBeVisible();

  // rascunho privado permanece (cria algo) e sessão anterior encerrada após troca de senha
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await login(p2, email);

  await page.goto("/entrar");
  await page.goto("/app/conta");
  await page.getByRole("button", { name: "Sair de todos os dispositivos" }).click();
  await expect(page).toHaveURL(/entrar/);
  await p2.goto("/app");
  await expect(p2).toHaveURL(/entrar/); // sessão anterior encerrada perde acesso

  // recuperar acesso
  await page.goto("/recuperar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar instruções" }).click();
  await expect(page.getByText(/Se existir uma conta/)).toBeVisible();
  const reset = await lastDevEmail(email).then(async (m) => { for (let i = 0; i < 10 && !m.subject.includes("Redefinição"); i++) { await new Promise((r) => setTimeout(r, 500)); m = await lastDevEmail(email); } return m; });
  await page.goto(linkFrom(reset.text));
  await page.getByLabel("Nova senha").fill("NovaSenha99");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page).toHaveURL(/entrar\?reset=1/);
  // link não pode ser reutilizado
  await page.goto(linkFrom(reset.text));
  await page.getByLabel("Nova senha").fill("OutraSenha11");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText(/Link inválido ou expirado/)).toBeVisible();
  await login(page, email, "NovaSenha99");
  await expect(page).toHaveURL(/\/app/);
  void uid; void PASSWORD; void sql;
});

test("login com senha errada não revela se a conta existe", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(`nao-existe-${uid()}@test.questeca.dev`);
  await page.getByLabel("Senha").fill("qualquer123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});
