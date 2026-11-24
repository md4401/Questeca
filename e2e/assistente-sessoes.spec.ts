import { test, expect as baseExpect } from "@playwright/test";
import { signup } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 15000 });
// Precisa do servidor falso de IA: node e2e/mock-llm.mjs, e o app com AI_PROVIDER=nvidia NVIDIA_API_KEY=x NVIDIA_URL=http://127.0.0.1:9999/v1
test.skip(!process.env.E2E_AI_MOCK, "defina E2E_AI_MOCK=1 com o servidor falso de IA");

test("GizIA em sessões como no ChatGPT: nova conversa, histórico, reabrir, renomear e apagar", async ({ page: t }) => {
  test.setTimeout(120_000);
  await signup(t);
  await t.goto("/app/assistente");
  const enviar = async (msg: string) => { await t.getByLabel("Mensagem para a GizIA").fill(msg); await t.getByLabel("Mensagem para a GizIA").press("Enter"); };
  const itens = t.getByTestId("sessao-item");
  await expect(itens).toHaveCount(0);

  // 1ª conversa: o título vem da primeira mensagem e a conversa entra no topo da lista
  await enviar("Primeira conversa sobre funções");
  await expect(t.getByTestId("msg-assistente").first()).toBeVisible();
  await expect(itens).toHaveCount(1);
  await expect(itens.first()).toContainText("Primeira conversa sobre funções");
  expect(t.url()).toContain("?s=");

  // 2ª conversa separada
  await t.getByTestId("nova-conversa").click();
  await expect(t.getByTestId("msg-usuario")).toHaveCount(0);
  await enviar("Segunda conversa sobre Machado");
  await expect(itens).toHaveCount(2);
  await expect(itens.first()).toContainText("Segunda conversa");

  // reabrir a primeira mostra só o histórico dela
  await itens.nth(1).getByRole("button", { name: /Primeira conversa/ }).first().click();
  await expect(t.getByTestId("msg-usuario").first()).toContainText("Primeira conversa");
  await expect(t.getByText("Segunda conversa sobre Machado", { exact: false })).toHaveCount(1); // só o título na lista

  // o histórico sobrevive a recarregar a página
  await t.reload();
  await expect(t.getByTestId("msg-usuario").first()).toContainText("Primeira conversa");
  await expect(itens).toHaveCount(2);

  // renomear
  await t.getByRole("button", { name: /Renomear a conversa Primeira/ }).click();
  await t.getByLabel("Novo nome da conversa").fill("Funções do 9º ano");
  await t.getByLabel("Novo nome da conversa").press("Enter");
  await expect(itens.filter({ hasText: "Funções do 9º ano" })).toHaveCount(1);

  // apagar (confirmação) e voltar à tela inicial de nova conversa
  t.once("dialog", (d) => d.accept());
  await t.getByRole("button", { name: /Apagar a conversa Funções do 9º ano/ }).click();
  await expect(itens).toHaveCount(1);
  await expect(t.getByText("O que vamos fazer hoje?")).toBeVisible();
});
