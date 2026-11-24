import { test, expect } from "@playwright/test";
import { signup } from "./helpers";

test("Mensagens: duas colunas, modal de nova conversa e sem contatos", async ({ page }) => {
  await signup(page);
  await page.goto("/app/chat");
  await expect(page.getByRole("heading", { name: "Mensagens" })).toBeVisible();
  await expect(page.getByText(/Ninguém disponível/)).toBeVisible();
  await expect(page.getByText("Escolha uma conversa para começar.")).toBeVisible();
  await expect(page.getByLabel("Conversar com")).toHaveCount(0);
  await page.getByTestId("nova-conversa").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "/tmp/chat-shot.png" });
});
