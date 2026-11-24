import { test, expect as baseExpect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signup, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 12000 });

test("Início: saudação, 4 indicadores com gráfico, desempenho, agenda e recentes", async ({ page: t }) => {
  test.setTimeout(120_000);
  const email = await signup(t);
  await sql`update users set onboarding_done_at = now() where email = ${email}`;
  await t.goto("/app");
  const kpi = (k: string) => t.getByTestId(`kpi-${k}`).locator("strong");
  await expect(t.getByRole("heading", { level: 1 })).toContainText("Professora Teste".split(" ")[0]);
  await expect(t.getByTestId("criar-prova")).toHaveAttribute("href", "/app/provas/montar");
  for (const k of ["turmas", "alunos", "criadas", "pendentes"]) await expect(kpi(k)).toHaveText("0");
  await expect(t.getByTestId("desempenho").getByText("Ainda sem notas lançadas.")).toBeVisible();

  // dados: 1 turma, 2 alunos, 1 prova criada este mês, 1 atividade com a nota de um aluno faltando
  const [u] = await sql`select u.id, m.org_id from users u join memberships m on m.user_id = u.id where u.email = ${email} limit 1`;
  const [c] = await sql`insert into classes (org_id, name, grade, subject, year, created_by) values (${u.org_id}, '9º A', '9', 'matematica', 2026, ${u.id}) returning id`;
  await sql`insert into class_teachers (class_id, user_id) values (${c.id}, ${u.id})`;
  const al: string[] = [];
  for (const n of ["Ana", "Bruno"]) { const [s] = await sql`insert into students (org_id, name) values (${u.org_id}, ${n}) returning id`; al.push(s.id); await sql`insert into enrollments (class_id, student_id, status) values (${c.id}, ${s.id}, 'active')`; }
  const [gi] = await sql`insert into grade_items (class_id, title, period) values (${c.id}, 'Prova 1', '1º bimestre') returning id`;
  await sql`insert into grades (grade_item_id, student_id, value, state) values (${gi.id}, ${al[0]}, 8, 'value')`;
  await sql`insert into assessments (org_id, owner_id, title, scope) values (${u.org_id}, ${u.id}, 'Prova X', '{"willFall":[],"prerequisite":[],"notTaught":[],"confirm":[]}'::jsonb)`;
  await t.goto("/app");
  await expect(kpi("turmas")).toHaveText("1");
  await expect(kpi("alunos")).toHaveText("2");
  await expect(kpi("criadas")).toHaveText("1");
  await expect(kpi("pendentes")).toHaveText("1"); // falta a nota do Bruno
  await expect(t.getByTestId("kpi-criadas")).toContainText("este mês");
  // gráficos de tendência acessíveis
  await expect(t.getByRole("img", { name: /Turmas criadas, acumulado/ })).toBeVisible();
  // desempenho: média geral 8,0 do período e um ponto por atividade
  await expect(t.getByRole("img", { name: "Média geral 8,0 de 10 em 1º bimestre" })).toBeVisible();
  await expect(t.getByRole("img", { name: /Média por atividade em 1º bimestre: Prova 1 8,0/ })).toBeVisible();
  // recentes (computador: lado a lado)
  await t.setViewportSize({ width: 1440, height: 900 }); await t.goto("/app");
  await expect(t.getByRole("region", { name: "Atividades recentes" }).getByText("Prova 1")).toBeVisible();
  await expect(t.getByRole("region", { name: "Atividades recentes" }).getByText("média 8")).toBeVisible();
  await expect(t.getByRole("region", { name: "Provas recentes" }).getByText("Prova X")).toBeVisible();
  await expect(t.getByRole("region", { name: "Provas recentes" }).getByText("Rascunho")).toBeVisible();

  // trocar o período mostra o estado vazio daquele período
  await t.getByLabel("Período do desempenho").selectOption("2º bimestre");
  await t.waitForURL(/periodo=/);
  await expect(t.getByTestId("desempenho").getByText("Ainda sem notas lançadas.")).toBeVisible();

  // agenda: "+ Novo evento" abre o modal, cria e o evento aparece no cartão da Agenda
  await t.goto("/app");
  await t.getByTestId("novo-evento-inicio").click();
  const dlg = t.getByRole("dialog", { name: "Novo evento" });
  await expect(dlg).toBeVisible();
  await dlg.getByLabel("Título").fill("Conselho de classe");
  await dlg.getByLabel("Dia todo").check();
  await dlg.getByRole("button", { name: "Criar evento" }).click();
  await expect(dlg).toBeHidden();
  await expect(t.getByRole("region", { name: "Agenda" }).getByText("Conselho de classe")).toBeVisible();

  // completa a nota → sem pendência
  await sql`insert into grades (grade_item_id, student_id, value, state) values (${gi.id}, ${al[1]}, 6, 'value')`;
  await t.goto("/app");
  await expect(kpi("pendentes")).toHaveText("0");

  // acessibilidade (escuro e claro)
  const audit = async (p: Page, n: string) => { const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze(); const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"); expect(bad, `${n}: ${bad.map((v) => v.id + " " + v.nodes[0]?.target?.join(" ")).join(" | ")}`).toEqual([]); };
  await audit(t, "início escuro");
  await t.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await t.waitForTimeout(400); // fim das transições de cor
  await audit(t, "início claro");

  // celular: sem rolagem lateral, 4 indicadores em uma linha e abas Atividades/Provas
  await t.setViewportSize({ width: 390, height: 844 });
  await t.goto("/app");
  expect(await t.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await expect(t.getByRole("tab", { name: "Atividades recentes" })).toHaveAttribute("aria-selected", "true");
  await expect(t.getByRole("tabpanel", { name: "Atividades recentes" }).getByText("Prova 1")).toBeVisible();
  await t.getByRole("tab", { name: "Provas recentes" }).click();
  await expect(t.getByRole("tabpanel", { name: "Provas recentes" }).getByText("Prova X")).toBeVisible();
});
