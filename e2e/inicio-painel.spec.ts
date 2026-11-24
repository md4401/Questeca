import { test, expect as baseExpect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signup, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 12000 });

test("Início: indicadores (turmas, alunos, provas criadas/aplicadas, atividades pendentes) e atalhos rápidos", async ({ page: t }) => {
  test.setTimeout(90_000);
  const email = await signup(t);
  await sql`update users set onboarding_done_at = now() where email = ${email}`;
  await t.goto("/app");
  const kpi = (k: string) => t.getByTestId(`kpi-${k}`);
  // conta nova: tudo zerado
  for (const k of ["turmas", "alunos", "criadas", "aplicadas", "pendentes"]) await expect(kpi(k).locator("strong")).toHaveText("0");

  // atalhos rápidos
  const rapidos = t.getByTestId("atalhos-rapidos");
  for (const nome of ["Criar prova", "Cadastrar aluno", "Criar turma", "Consultar notas", "Banco de questões"]) await expect(rapidos.getByRole("link", { name: nome })).toBeVisible();
  await expect(rapidos.getByRole("link", { name: "Criar turma" })).toHaveAttribute("href", "/app/turmas/nova");
  await expect(rapidos.getByRole("link", { name: "Criar prova" })).toHaveAttribute("href", "/app/provas/montar");
  await expect(rapidos.getByRole("link", { name: "Consultar notas" })).toHaveAttribute("href", "/app/notas");
  await expect(rapidos.getByRole("link", { name: "Banco de questões" })).toHaveAttribute("href", "/app/banco");

  // dados: 1 turma, 2 alunos, 1 prova criada, 1 atividade com nota faltando
  const [u] = await sql`select u.id, m.org_id from users u join memberships m on m.user_id = u.id where u.email = ${email} limit 1`;
  const [c] = await sql`insert into classes (org_id, name, grade, subject, year, created_by) values (${u.org_id}, '9º A', '9', 'matematica', 2026, ${u.id}) returning id`;
  await sql`insert into class_teachers (class_id, user_id) values (${c.id}, ${u.id})`;
  const al = [];
  for (const n of ["Ana", "Bruno"]) { const [s] = await sql`insert into students (org_id, name) values (${u.org_id}, ${n}) returning id`; al.push(s.id); await sql`insert into enrollments (class_id, student_id, status) values (${c.id}, ${s.id}, 'active')`; }
  const [gi] = await sql`insert into grade_items (class_id, title, period) values (${c.id}, 'Trabalho 1', '1º bimestre') returning id`;
  await sql`insert into grades (grade_item_id, student_id, value, state) values (${gi.id}, ${al[0]}, 8, 'value')`;
  await sql`insert into assessments (org_id, owner_id, title, scope) values (${u.org_id}, ${u.id}, 'Prova X', '{"willFall":[],"prerequisite":[],"notTaught":[],"confirm":[]}'::jsonb)`;
  await t.goto("/app");
  await expect(kpi("turmas").locator("strong")).toHaveText("1");
  await expect(kpi("alunos").locator("strong")).toHaveText("2");
  await expect(kpi("criadas").locator("strong")).toHaveText("1");
  await expect(kpi("aplicadas").locator("strong")).toHaveText("0");
  await expect(kpi("pendentes").locator("strong")).toHaveText("1"); // falta a nota do Bruno
  await expect(rapidos.getByRole("link", { name: "Cadastrar aluno" })).toHaveAttribute("href", `/app/turmas/${c.id}/alunos`);

  // completa a nota → sem pendência
  await sql`insert into grades (grade_item_id, student_id, value, state) values (${gi.id}, ${al[1]}, 6, 'value')`;
  await t.goto("/app");
  await expect(kpi("pendentes").locator("strong")).toHaveText("0");

  // acessibilidade (claro e escuro) e celular
  const audit = async (p: Page, n: string) => { const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze(); const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"); expect(bad, `${n}: ${bad.map((v) => v.id + " " + v.nodes[0]?.target?.join(" ")).join(" | ")}`).toEqual([]); };
  await audit(t, "início dark");
  await t.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await audit(t, "início light");
  await t.setViewportSize({ width: 390, height: 800 });
  await t.goto("/app");
  const overflow = await t.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await expect(kpi("pendentes")).toBeVisible();
});
