import { test, expect } from "@playwright/test";
import { signup, sql } from "./helpers";

test("Tour de primeira visita: destaca regiões, navega, pula e não repete", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem("tour-force", "1"));
  await signup(page);
  await page.goto("/app/provas");
  const dlg = page.getByRole("dialog", { name: /Tour:/ });
  await expect(dlg).toBeVisible({ timeout: 8000 });
  await expect(dlg.getByText("1 de 4")).toBeVisible();
  await expect(page.locator(".tour-spot")).toBeVisible();
  await page.waitForTimeout(700); await page.screenshot({ path: "/tmp/tour-1.png" });
  await dlg.getByRole("button", { name: /Próximo/ }).click();
  await expect(dlg.getByText("2 de 4")).toBeVisible();
  await expect(dlg.getByRole("heading", { name: "Montar prova" })).toBeVisible();
  await page.waitForTimeout(700); await page.screenshot({ path: "/tmp/tour-2.png" });
  await dlg.getByRole("button", { name: /Voltar/ }).click();
  await expect(dlg.getByText("1 de 4")).toBeVisible();
  await dlg.getByRole("button", { name: "Pular" }).click();
  await expect(dlg).toBeHidden();
  await expect.poll(async () => (await sql`select prefs->'tours' as t from users order by created_at desc limit 1`)[0].t).toContain("provas");
  await page.reload();
  await page.waitForTimeout(2500);
  await expect(page.getByRole("dialog", { name: /Tour:/ })).toHaveCount(0);
  // refazer pelo botão do cabeçalho
  await page.getByRole("button", { name: "Refazer o tour desta página" }).first().click();
  await expect(page.getByRole("dialog", { name: /Tour:/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Tour:/ })).toHaveCount(0);
  // celular: o balão cabe na tela
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole("button", { name: "Refazer o tour desta página" }).first().click();
  const d2 = page.getByRole("dialog", { name: /Tour:/ });
  await expect(d2).toBeVisible();
  const b = (await d2.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(390.5); expect(b.y + b.height).toBeLessThanOrEqual(800);
  await page.waitForTimeout(700); await page.screenshot({ path: "/tmp/tour-m.png" });
});
