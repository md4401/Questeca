import { test, expect as baseExpect, type Page } from "@playwright/test";
import { signup, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 12000 });

/** Estrutura responsiva: celular (abas inferiores), tablet (menu só com ícones) e computador (menu completo), sem rolagem lateral. */
const MODOS = [
  { nome: "celular pequeno", w: 360, h: 740, modo: "celular" }, { nome: "celular", w: 390, h: 844, modo: "celular" }, { nome: "celular grande", w: 639, h: 900, modo: "celular" },
  { nome: "tablet em pé", w: 768, h: 1024, modo: "tablet" }, { nome: "tablet deitado", w: 1023, h: 768, modo: "tablet" },
  { nome: "notebook", w: 1024, h: 768, modo: "computador" }, { nome: "desktop", w: 1280, h: 800, modo: "computador" }, { nome: "tela grande", w: 1920, h: 1080, modo: "computador" },
] as const;

const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("Layout responsivo: modo de navegação por largura e nenhuma página com rolagem lateral", async ({ page: t }) => {
  test.setTimeout(240_000);
  const email = await signup(t);
  await sql`update users set onboarding_done_at = now() where email = ${email}`;
  const [u] = await sql`select u.id, m.org_id from users u join memberships m on m.user_id = u.id where u.email = ${email} limit 1`;
  const [c] = await sql`insert into classes (org_id, name, grade, subject, year, created_by) values (${u.org_id}, '9º A', '9', 'matematica', 2026, ${u.id}) returning id`;
  await sql`insert into class_teachers (class_id, user_id) values (${c.id}, ${u.id})`;
  const [s] = await sql`insert into students (org_id, name) values (${u.org_id}, 'Ana Souza') returning id`;
  await sql`insert into enrollments (class_id, student_id, status) values (${c.id}, ${s.id}, 'active')`;
  await sql`insert into grade_items (class_id, title, period) values (${c.id}, 'Prova 1', '1º bimestre')`;
  const rotas = ["/app", "/app/turmas", `/app/turmas/${c.id}`, "/app/notas", "/app/provas", "/app/provas/montar", "/app/banco?q=machado", "/app/assistente", "/app/planos-de-aula", "/app/agenda", "/app/conta"];

  for (const m of MODOS) {
    await t.setViewportSize({ width: m.w, height: m.h });
    await t.goto("/app");
    const side = t.locator("aside.side"); const tabs = t.getByRole("navigation", { name: "Navegação principal" });
    if (m.modo === "celular") {
      await expect(tabs, m.nome).toBeVisible(); await expect(side, m.nome).toBeHidden();
    } else {
      await expect(tabs, m.nome).toBeHidden(); await expect(side, m.nome).toBeVisible();
      const largura = (await side.boundingBox())!.width;
      if (m.modo === "tablet") {
        expect(largura, `${m.nome}: menu só com ícones`).toBeLessThan(100);
        // continua acessível por nome (leitor de tela) e com dica ao passar o mouse
        await expect(side.getByRole("link", { name: "Provas" }), m.nome).toHaveAttribute("title", "Provas");
        await expect(side.getByRole("link", { name: "GizIA" }), m.nome).toBeVisible();
      } else {
        expect(largura, `${m.nome}: menu completo`).toBeGreaterThan(230);
        await expect(side.getByText("Planos de aula"), m.nome).toBeVisible();
      }
    }
    for (const r of rotas) {
      await t.goto(r);
      const over = await overflow(t);
      expect(over, `${m.nome} (${m.w}px) ${r}: rolagem lateral de ${over}px`).toBeLessThanOrEqual(0);
    }
    // Início: quatro indicadores sempre numa única linha (celular inclusive)
    await t.goto("/app");
    const ys = await t.getByTestId("indicadores").locator("li").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(ys.length, `${m.nome}: indicadores`).toBe(4);
    expect(new Set(ys).size, `${m.nome}: indicadores em uma linha`).toBe(1);
  }
});

test("Alvos de toque: botões e links principais têm pelo menos 40px em telas de toque", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL: "http://localhost:3100" });
  const t = await ctx.newPage();
  const email = await signup(t);
  await sql`update users set onboarding_done_at = now() where email = ${email}`;
  await t.goto("/app");
  const pequenos = await t.evaluate(() => Array.from(document.querySelectorAll("nav[aria-label='Navegação principal'] a, nav[aria-label='Navegação principal'] button, [data-testid='indicadores'] a, [data-testid='criar-prova']"))
    .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height < 40; }).map((e) => e.textContent?.trim()));
  expect(pequenos, "alvos de toque pequenos").toEqual([]);
  await ctx.close();
});
