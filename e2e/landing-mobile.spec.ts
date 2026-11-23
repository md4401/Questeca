import { test, expect as baseExpect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const expect = baseExpect.configure({ soft: true, timeout: 8000 });

const audit = async (page: Page, name: string) => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(`A11Y ${name}:`, bad.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target?.join(" ")}`).join(" | "));
  expect(bad, `${name}: ${bad.map((v) => v.id).join(", ")}`).toEqual([]);
};

for (const [w, h] of [[360, 640], [390, 844], [430, 932]]) {
  test(`Página pública no celular ${w}×${h}: primeira tela, folha interativa, menu, sem rolagem lateral`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    // primeira tela: título e botão visíveis antes da rolagem
    const h1 = page.getByRole("heading", { level: 1, name: "Crie provas com o que sua turma estudou" });
    const cta = page.getByRole("link", { name: "Criar minha primeira prova" }).first();
    await expect(h1).toBeInViewport(); await expect(cta).toBeInViewport({ ratio: 1 });
    expect(await cta.getAttribute("href")).toBe("/criar-conta");
    await expect(page.getByText("Revise questões reais e baixe a prova com o gabarito separado.")).toBeVisible();
    // cabeçalho móvel: marca, Entrar e Menu (sem Criar conta)
    const head = page.locator("header").first();
    await expect(head.getByRole("link", { name: "Entrar" })).toBeVisible();
    await expect(head.getByLabel("Abrir menu")).toBeVisible();
    await expect(head.getByRole("link", { name: "Criar conta" })).toBeHidden();
    for (const el of [head.getByRole("link", { name: "Entrar" }), head.getByLabel("Abrir menu")]) { const b = (await el.boundingBox())!; expect(b.width).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44); }
    // Agendar demonstração saiu da abertura e está em Para escolas
    await expect(page.getByRole("button", { name: "Agendar demonstração" })).toHaveCount(1);
    expect(await page.getByRole("button", { name: "Agendar demonstração" }).evaluate((e) => !!e.closest("#para-escolas"))).toBe(true);

    // folha: uma escolha muda a questão e o total; desmarcar reverte
    const sheet = page.getByRole("region", { name: "Exemplo da folha da prova" });
    const juros = sheet.getByRole("button", { name: /Já ensinei juros compostos/ });
    await expect(sheet.getByText("2 de 4 entram na prova")).toBeVisible();
    await expect(sheet.getByText(/Fica de fora/)).toBeVisible();
    await juros.click();
    await expect(juros).toHaveAttribute("aria-pressed", "true");
    await expect(sheet.getByText("3 de 4 entram na prova")).toBeVisible();
    await expect(sheet.getByText("Entra na prova")).toBeVisible();
    await juros.click();
    await expect(sheet.getByText("2 de 4 entram na prova")).toBeVisible(); await expect(sheet.getByText(/Fica de fora/)).toBeVisible();
    // teclado
    await juros.focus(); await page.keyboard.press("Space");
    await expect(sheet.getByText("3 de 4 entram na prova")).toBeVisible();
    await page.keyboard.press("Enter"); await expect(sheet.getByText("2 de 4 entram na prova")).toBeVisible();
    // exemplo completo: quatro temas e quatro itens, com as mesmas escolhas
    const more = sheet.locator("button[aria-expanded]");
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await expect(sheet.getByRole("group", { name: "Conteúdos ensinados" }).getByRole("button")).toHaveCount(4);
    await expect(sheet.locator("ol > li")).toHaveCount(4);
    await expect(sheet.getByText("2 de 4 entram na prova")).toBeVisible();
    await sheet.getByRole("button", { name: "Juros compostos" }).click();
    await expect(sheet.getByText("3 de 4 entram na prova")).toBeVisible();
    await sheet.getByRole("button", { name: "Ver só uma questão" }).click();
    await expect(sheet.getByRole("button", { name: /Já ensinei juros compostos/ })).toHaveAttribute("aria-pressed", "true"); // mesma escolha
    // recursos agrupados e abrem ao toque
    for (const g of ["Preparar a prova", "Aplicar e corrigir", "Acompanhar a turma"]) await expect(page.getByRole("heading", { name: g })).toBeVisible();
    await expect(page.locator("#recursos details")).toHaveCount(7);
    await page.locator("#recursos summary").first().click();
    await expect(page.locator("#recursos details[open]")).toHaveCount(1);
    // menu mantém os destinos
    await head.getByLabel("Abrir menu").click();
    const menu = page.getByRole("navigation", { name: "Menu" });
    for (const [n, href] of [["Como funciona", "/#como-funciona"], ["Recursos", "/#recursos"], ["Planos", "/#planos"], ["Para escolas", "/escolas"], ["Ajuda", "/ajuda"], ["Criar conta", "/criar-conta"], ["Entrar", "/entrar"]]) {
      await expect(menu.getByRole("link", { name: n, exact: true })).toHaveAttribute("href", href);
    }
    await page.keyboard.press("Escape");
    // sem rolagem lateral
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await audit(page, `publica-${w}`);
  });
}

test("Página pública no desktop e com zoom de 200% (viewport estreito) sem rolagem lateral", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 860 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Criar conta" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Crie provas com o que sua turma estudou");
  await audit(page, "publica-desktop");
  await page.setViewportSize({ width: 180, height: 320 }); // 360 px a 200%
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const p of ["/planos", "/escolas", "/ajuda"]) { await page.goto(p); await expect(page.locator("main")).toBeVisible(); }
});
