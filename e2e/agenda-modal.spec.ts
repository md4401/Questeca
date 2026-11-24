import { test, expect as baseExpect } from "@playwright/test";
import { signup, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 12000 });

test("Agenda: sem lista da semana; 'Adicionar evento' abre modal, cria, fecha e permite excluir", async ({ page: t }) => {
  test.setTimeout(90_000);
  const email = await signup(t);
  await sql`update users set onboarding_done_at = now() where email = ${email}`;
  await t.goto("/app/agenda");
  // a lista de dias da semana ("Semana de 23/11 a 29/11") e o formulário fixo saíram da página
  await expect(t.getByText(/^Semana de /)).toHaveCount(0);
  await expect(t.getByRole("heading", { name: "Novo evento" })).toBeHidden();
  const botao = t.getByTestId("adicionar-evento");
  await expect(botao).toHaveText("Adicionar evento");

  // abre o modal; Esc fecha sem criar
  await botao.click();
  const dlg = t.getByRole("dialog", { name: "Novo evento" });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByLabel("Título")).toBeFocused();
  await t.keyboard.press("Escape");
  await expect(dlg).toBeHidden();

  // abre de novo, preenche e cria; o modal fecha e o evento aparece no dia
  await botao.click();
  await dlg.getByLabel("Título").fill("Reunião de pais");
  await dlg.getByLabel("Categoria").selectOption("reuniao");
  // sem horário nem "dia todo": mostra o erro e mantém o modal aberto com o que foi digitado
  await dlg.getByRole("button", { name: "Criar evento" }).click();
  await expect(t.getByText(/Informe o horário de início ou marque/)).toBeVisible();
  await expect(dlg.getByLabel("Título")).toHaveValue("Reunião de pais");
  await dlg.getByLabel("Dia todo").check();
  await dlg.getByRole("button", { name: "Criar evento" }).click();
  await expect(t.getByText("Evento criado.")).toBeVisible();
  await expect(dlg).toBeHidden();
  await expect(t.getByRole("region", { name: /Eventos de/ }).getByText("Reunião de pais")).toBeVisible();

  // título obrigatório (validação nativa) e cancelar
  await botao.click();
  await dlg.getByRole("button", { name: "Cancelar" }).click();
  await expect(dlg).toBeHidden();

  // excluir pelo painel do dia
  await t.getByRole("region", { name: /Eventos de/ }).getByRole("button", { name: "Excluir" }).click();
  await expect(t.getByRole("region", { name: /Eventos de/ }).getByText("Reunião de pais")).toHaveCount(0);

  // celular: botão continua no topo e o modal vira folha sem rolagem lateral
  await t.setViewportSize({ width: 390, height: 844 });
  await t.goto("/app/agenda");
  await botao.click();
  await expect(dlg).toBeVisible();
  expect(await t.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
