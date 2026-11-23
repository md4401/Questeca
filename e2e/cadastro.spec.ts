import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signup, sql, uid } from "./helpers";

// Escolas FICTÍCIAS, só no banco de testes (fonte "teste-e2e"); a produção usa o catálogo do Inep.
test.beforeAll(async () => {
  const rows = [
    ["Colégio Horizonte - unidade Centro", "colegio horizonte - unidade centro", "Osasco", "osasco", "SP", "Centro"],
    ["Colégio Horizonte - unidade Norte", "colegio horizonte - unidade norte", "São Paulo", "sao paulo", "SP", "Santana"],
    ["Escola Municipal Ágata Teste", "escola municipal agata teste", "Recife", "recife", "PE", null],
  ];
  for (const [name, nn, city, cn, uf, nb] of rows) {
    await sql`insert into schools (name, name_norm, city, city_norm, uf, neighborhood, source, source_year)
      select ${name}, ${nn}, ${city}, ${cn}, ${uf}, ${nb}, 'teste-e2e', 2025 where not exists (select 1 from schools where name_norm = ${nn})`;
  }
});

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function noOverflow(page: Page) {
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(w.sw, "rolagem lateral").toBeLessThanOrEqual(w.cw);
}

test("cadastro em 3 etapas: busca sem acento, duas disciplinas, turmas diferentes, retomar e concluir", async ({ page }) => {
  const email = await signup(page);
  await expect(page).toHaveURL(/\/cadastro/);
  await expect(page.getByText("Etapa 1 de 3")).toBeVisible();

  // etapa 1: Continuar sem escolher é bloqueado
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("main p.err")).toContainText("Escolha seu colégio");

  // busca parcial, sem acento
  await page.getByLabel("Nome do colégio").fill("colegio horiz");
  const centro = page.getByRole("button", { name: /unidade Centro/ });
  const norte = page.getByRole("button", { name: /unidade Norte/ });
  await expect(centro).toBeVisible(); await expect(norte).toBeVisible();
  await expect(centro).toContainText("Osasco · SP"); await expect(norte).toContainText("São Paulo · SP");
  // filtro por município
  await page.getByRole("button", { name: "Filtrar por cidade e UF" }).click();
  await page.getByLabel("Cidade").fill("osasco");
  await expect(norte).toHaveCount(0);
  await expect(centro).toBeVisible();
  await centro.click();
  await expect(centro).toHaveAttribute("aria-pressed", "true");
  await noOverflow(page);
  await page.getByRole("button", { name: "Continuar" }).click();

  // etapa 2
  await expect(page.getByText("Etapa 2 de 3")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("main p.err")).toContainText("ao menos uma disciplina");
  await page.getByRole("button", { name: "Matemática" }).click();
  await page.getByRole("button", { name: "Física" }).click();
  await expect(page.getByText("2 selecionadas")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // etapa 3: associações separadas por disciplina
  await expect(page.getByText("Etapa 3 de 3")).toBeVisible();
  const mat = page.getByRole("region", { name: "Matemática" });
  const fis = page.getByRole("region", { name: "Física" });
  await mat.getByRole("button", { name: "9º ano" }).click();
  await mat.getByRole("button", { name: "Turma A, 9º ano" }).click();
  await mat.getByRole("button", { name: "Turma B, 9º ano" }).click();
  await expect(mat.getByText("Matemática · 9º A e 9º B")).toBeVisible();
  await fis.getByRole("button", { name: "1ª série" }).click();
  await fis.getByRole("button", { name: "Turma A, 1ª série" }).click();
  await expect(fis.getByText("Física · 1ª A")).toBeVisible();
  await noOverflow(page);

  // voltar uma etapa, recarregar e retomar do último passo salvo
  await page.getByRole("button", { name: "← Voltar" }).click();
  await expect(page.getByText("Etapa 2 de 3")).toBeVisible();
  await page.waitForTimeout(1500); // rascunho salvo
  await page.reload();
  await expect(page.getByText("Etapa 2 de 3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Matemática" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(mat.getByText("Matemática · 9º A e 9º B")).toBeVisible(); // associações preservadas
  await page.getByRole("button", { name: "Continuar" }).click();

  // revisão editável
  await expect(page.getByRole("heading", { name: "Confira e conclua" })).toBeVisible();
  await expect(page.getByText("Colégio Horizonte - unidade Centro · Osasco/SP")).toBeVisible();
  await expect(page.getByText("Física · 1ª A")).toBeVisible();
  await page.getByRole("button", { name: "Concluir cadastro" }).click();

  // contexto salvo aparece no Início
  await page.waitForURL(/\/app\?novo=1/);
  await expect(page.getByText("Cadastro concluído")).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar minha primeira prova" })).toBeVisible();
  await expect(page.getByText("Colégio Horizonte - unidade Centro · Osasco/SP").first()).toBeVisible();
  await noOverflow(page);

  // banco: turmas criadas e escola é só contexto (continua espaço pessoal, sem acesso institucional)
  const [u] = await sql`select id from users where email = ${email}`;
  const cls = await sql`select c.name, c.subject, c.grade from classes c join class_teachers ct on ct.class_id = c.id where ct.user_id = ${u.id} order by c.name`;
  expect(cls.map((c) => `${c.subject}:${c.name}`)).toEqual(["matematica:9º A", "matematica:9º B", "fisica:1ª A"].sort((a, b) => a.split(":")[1].localeCompare(b.split(":")[1])));
  const orgs = await sql`select o.kind, o.name, o.uf, o.school_id from memberships m join orgs o on o.id = m.org_id where m.user_id = ${u.id}`;
  expect(orgs).toHaveLength(1);
  expect(orgs[0].kind).toBe("personal"); expect(orgs[0].uf).toBe("SP"); expect(orgs[0].school_id).not.toBeNull();

  // prova nova já vem com a turma escolhida
  await page.getByRole("link", { name: "Criar minha primeira prova" }).click();
  await expect(page.getByLabel("Para qual turma?")).not.toHaveValue("");

  // perfil: editar mantém o que existe
  await page.goto("/cadastro?editar=1");
  await expect(page.getByText("Etapa 1 de 3")).toBeVisible();
  await expect(page.getByRole("button", { name: /unidade Centro/ }).or(page.getByLabel("Nome do colégio"))).toBeVisible();
});

test("busca de escolas: vazio, falha com nova tentativa, cadastro manual e sem escola fixa", async ({ page }) => {
  await signup(page);
  await page.getByLabel("Nome do colégio").fill("zzzz inexistente");
  await expect(page.getByText("Nenhuma escola encontrada")).toBeVisible();

  // falha de conexão é um estado próprio, com Tentar novamente e Alterar cidade
  let fail = true;
  await page.route("**/api/escolas*", (r) => (fail ? r.abort() : r.continue()));
  await page.getByLabel("Nome do colégio").fill("horizonte");
  await expect(page.getByText("Não foi possível buscar agora")).toBeVisible();
  await expect(page.getByRole("button", { name: "Alterar cidade" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("button", { name: /unidade Centro/ })).toBeVisible();

  // cadastro manual exige nome, cidade e UF
  await page.getByRole("button", { name: /Não encontrei meu colégio/ }).click();
  await page.getByLabel("Nome do colégio").first().fill("Colégio Aurora do Sul");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("main p.err")).toContainText("nome, cidade e UF");
  await page.locator("#m-city").fill("Curitiba");
  await page.locator("#m-uf").selectOption("PR");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Etapa 2 de 3")).toBeVisible();
  await page.getByRole("button", { name: "← Voltar" }).click();
  await page.getByRole("button", { name: "Não dou aula em uma escola fixa" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  // outra disciplina + outra identificação de turma
  await page.getByLabel("Outra disciplina").fill("Robótica");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  const sec = page.getByRole("region", { name: "Robótica" });
  await sec.getByRole("button", { name: "7º ano" }).click();
  await sec.getByLabel("Outra identificação, 7º ano").fill("Turma Alfa");
  await sec.getByRole("button", { name: "Adicionar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Sem escola fixa")).toBeVisible();
  await expect(page.getByText("Robótica · Turma Alfa")).toBeVisible();
  await page.getByRole("button", { name: "Concluir cadastro" }).click();
  await page.waitForURL(/\/app\?novo=1/);
  await expect(page.locator("header").getByText("Espaço pessoal")).toBeVisible();
});

test("escola de convite aparece já vinculada e a busca exige login", async ({ page, request }) => {
  const anon = await request.get("/api/escolas?q=horizonte");
  expect(anon.status()).toBe(401);
  const email = await signup(page);
  const [u] = await sql`select id from users where email = ${email}`;
  const [o] = await sql`insert into orgs (name, kind, owner_id) values (${"Escola Convite " + uid()}, 'school', ${u.id}) returning id, name`;
  await sql`insert into memberships (org_id, user_id, role) values (${o.id}, ${u.id}, 'teacher')`;
  await sql`update sessions set active_org_id = ${o.id} where user_id = ${u.id}`;
  await page.goto("/cadastro");
  await expect(page.getByText("Escola vinculada pelo convite")).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(o.name as string) })).toHaveAttribute("aria-pressed", "true");
});

for (const width of [360, 430]) {
  test(`sem rolagem lateral em ${width}px (cadastro e início)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await signup(page);
    await noOverflow(page);
    await page.goto("/app/turmas/nova");
    await noOverflow(page);
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  });
}

test("acessibilidade (axe WCAG 2.2 AA) em cada etapa, no início com navegação inferior e nos textos legais", async ({ page }) => {
  test.setTimeout(180_000);
  const audit = async (name: string) => {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    if (bad.length) console.log(`A11Y ${name}:`, bad.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target?.join(" ")}`).join(" | "));
    expect(bad, `${name}: ${bad.map((v) => v.id).join(", ")}`).toEqual([]);
  };
  for (const p of ["/termos", "/privacidade"]) { await page.goto(p); await audit(p); }
  await signup(page);
  await page.getByLabel("Nome do colégio").fill("colegio horiz");
  await page.getByRole("button", { name: /unidade Centro/ }).click();
  await audit("etapa 1");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Matemática" }).click();
  await audit("etapa 2");
  await page.getByRole("button", { name: "Continuar" }).click();
  const mat = page.getByRole("region", { name: "Matemática" });
  await mat.getByRole("button", { name: "8º ano" }).click();
  await mat.getByRole("button", { name: "Turma C, 8º ano" }).click();
  await audit("etapa 3");
  await page.getByRole("button", { name: "Continuar" }).click();
  await audit("revisão");
  await page.getByRole("button", { name: "Concluir cadastro" }).click();
  await page.waitForURL(/\/app\?novo=1/);
  await audit("início (celular)");
  await page.getByRole("button", { name: "Mais" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit("folha Mais");
});
