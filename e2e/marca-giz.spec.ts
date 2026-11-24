import { test, expect as baseExpect } from "@playwright/test";
import { signup, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 12000 });

test("Marca Segunda Lousa em todo lugar, GizIA no menu e tema claro como padrão", async ({ page: t, browser }) => {
  test.setTimeout(90_000);
  // páginas públicas: nome novo, nada de "Questeca"
  for (const rota of ["/", "/entrar", "/criar-conta", "/termos", "/privacidade"]) {
    await t.goto(rota);
    const texto = await t.locator("body").innerText();
    expect(texto, `${rota} ainda cita Questeca`).not.toMatch(/questeca/i);
    expect(await t.title(), `${rota} título`).not.toMatch(/questeca/i);
  }
  await t.goto("/");
  expect(await t.title()).toContain("Segunda Lousa");
  await expect(t.getByRole("link", { name: /Segunda Lousa — início/ }).first()).toBeVisible();

  // área logada: claro por padrão, menu com GizIA, sem "Questeca"
  const email = await signup(t);
  await sql`update users set onboarding_done_at = now() where email = ${email}`;
  await t.goto("/app");
  expect(await t.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  await expect(t.locator("aside.side").getByRole("link", { name: "GizIA" })).toBeVisible();
  for (const rota of ["/app", "/app/gizia".replace("gizia", "assistente"), "/app/provas", "/app/banco", "/app/conta", "/app/agenda"]) {
    await t.goto(rota);
    expect((await t.locator("body").innerText()).replace(/\S+@\S+/g, ""), `${rota} ainda cita Questeca`).not.toMatch(/questeca/i); // ignora o e-mail de teste do banner
  }
  await t.goto("/app/assistente");
  await expect(t.getByRole("heading", { name: "GizIA", level: 1 })).toBeVisible();

  // quem escolhe escuro continua com escuro; sair e entrar de novo em outro aparelho sem escolha volta ao claro
  await t.goto("/app");
  await t.getByRole("button", { name: "Modo escuro" }).click();
  await expect(t.locator("html")).toHaveAttribute("data-theme", "dark");
  await t.reload();
  await expect(t.locator("html")).toHaveAttribute("data-theme", "dark");
  const outro = await browser.newContext(); const p2 = await outro.newPage();
  await signup(p2);
  await p2.goto("/app");
  expect(await p2.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
});

test("Permissão para a GizIA criar questões: padrão desligado, liga em Minha conta e preserva o tema", async ({ page: t }) => {
  test.setTimeout(60_000);
  const email = await signup(t);
  await t.goto("/app/conta");
  const caixa = t.getByLabel("Permitir que a GizIA crie questões novas para as minhas provas");
  await expect(caixa).not.toBeChecked();
  await t.getByRole("button", { name: "Modo escuro" }).click().catch(() => {});
  await caixa.check();
  await t.getByRole("button", { name: "Salvar", exact: true }).first().click();
  await expect(t.getByText(/Preferências salvas/)).toBeVisible(); // espera o salvamento antes de recarregar
  await t.goto("/app/conta");
  await expect(t.getByLabel("Permitir que a GizIA crie questões novas para as minhas provas")).toBeChecked();
  const [u] = await sql`select prefs from users where email = ${email}`;
  expect(u.prefs.gizCriaQuestoes).toBe(true);
  expect(u.prefs.theme).toBe("dark"); // salvar o perfil não apaga o tema escolhido
});
