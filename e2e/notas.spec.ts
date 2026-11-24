import { test, expect as baseExpect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signup, createClass, addStudents, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 10000 });

const audit = async (page: Page, name: string) => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(`A11Y ${name}:`, bad.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target?.join(" ")}`).join(" | "));
  expect(bad, `${name}: ${bad.map((v) => v.id).join(", ")}`).toEqual([]);
};

test("Página Notas: menu básico, turma e período, atividades, lançamento, média, situação e visão do aluno", async ({ page: t }) => {
  test.setTimeout(150_000);
  const email = await signup(t, { name: "Professora Notas" });
  await sql`update subscriptions set plan = 'teacher' where org_id in (select m.org_id from memberships m join users u on u.id = m.user_id where u.email = ${email})`;
  const turmaA = await createClass(t, "9º A");
  await addStudents(t, turmaA, "Ana Souza;1\nBruno Dias;2\nCarlos Lima;3");
  await createClass(t, "8º B");

  // menu básico: sem Radar, Coordenação e Moderação; com Notas
  await t.goto("/app");
  const nav = t.getByRole("navigation", { name: "Principal" });
  for (const n of ["Turmas", "Notas", "Planos de aula", "Agenda", "Provas", "Banco de questões", "Mensagens"]) await expect(nav.getByRole("link", { name: n, exact: true })).toBeVisible();
  for (const n of ["Radar de alunos", "Coordenação", "Moderação", "Comunidade", "Materiais", "Escanear cartão"]) await expect(nav.getByRole("link", { name: n })).toHaveCount(0);
  await expect(t.getByTestId("radar-home")).toHaveCount(0);

  await t.getByRole("link", { name: "Notas", exact: true }).first().click();
  await t.waitForURL(/\/app\/notas/);
  await expect(t.getByRole("heading", { level: 1, name: "Notas" })).toBeVisible();
  await t.getByLabel("Turma", { exact: true }).selectOption({ label: "9º A" });
  await t.getByRole("button", { name: "Abrir" }).click();
  await t.waitForURL(new RegExp(`turma=${turmaA}`));

  // adicionar atividades
  await t.getByRole("link", { name: "+ Nova avaliação" }).click();
  await t.getByLabel("Atividade", { exact: true }).fill("Prova 1");
  await t.getByLabel("Peso").fill("2");
  await t.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(t.getByTestId("visao-notas").getByRole("columnheader", { name: /Prova 1/ })).toBeVisible();
  await t.getByLabel("Atividade", { exact: true }).fill("Trabalho 1");
  await t.getByLabel("Categoria").selectOption("trabalho");
  await t.getByLabel("Peso").fill("1");
  await t.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(t.getByTestId("visao-notas").getByRole("columnheader", { name: /Trabalho 1/ })).toBeVisible();
  await expect(t.getByTestId("visao-notas").getByRole("columnheader", { name: /Prova 1/ })).toContainText("Peso: 67%");

  // lançar notas
  const put = async (aluno: string, ativ: string, v: string) => { const c = t.getByLabel(`${aluno} — ${ativ}`); await c.fill(v); await c.press("Tab"); };
  await put("Ana Souza", "Prova 1", "9"); await put("Ana Souza", "Trabalho 1", "6");
  await put("Bruno Dias", "Prova 1", "3"); await put("Bruno Dias", "Trabalho 1", "4");
  await put("Carlos Lima", "Prova 1", "5"); await put("Carlos Lima", "Trabalho 1", "6");
  await expect.poll(async () => (await sql`select count(*)::int n from grades g join grade_items i on i.id = g.grade_item_id where i.class_id = ${turmaA} and g.state = 'value'`)[0].n, { timeout: 15000 }).toBeGreaterThanOrEqual(6);

  await t.reload();
  const tab = t.getByTestId("visao-notas");
  const ana = tab.getByRole("row", { name: /Ana Souza/ }); const bruno = tab.getByRole("row", { name: /Bruno Dias/ }); const carlos = tab.getByRole("row", { name: /Carlos Lima/ });
  await expect(ana).toContainText("9"); await expect(ana).toContainText("8"); await expect(ana).toContainText("Aprovado");
  await expect(bruno).toContainText("3,3"); await expect(bruno).toContainText("Reprovado");
  await expect(carlos).toContainText("5,3"); await expect(carlos).toContainText("Recuperação");
  await audit(t, "notas");

  // período outro: sem atividades; turma outra: sem alunos
  await t.getByRole("link", { name: "2º bimestre" }).click();
  await expect(t.getByRole("columnheader", { name: /Prova 1/ })).toHaveCount(0);
  await t.getByRole("link", { name: "1º bimestre" }).click();

  // visão por aluno
  await t.getByRole("link", { name: "Ana Souza" }).first().click();
  await t.waitForURL(/\/app\/notas\/aluno\//);
  await expect(t.getByRole("heading", { level: 1, name: "Ana Souza" })).toBeVisible();
  const p1 = t.getByRole("region", { name: "Notas de Ana Souza em 1º bimestre" });
  await expect(p1).toContainText("Prova 1"); await expect(p1).toContainText("Trabalho 1"); await expect(p1).toContainText("Média 8"); await expect(p1).toContainText("Aprovado");
  await audit(t, "notas-aluno");
  // aluno de outra turma não abre
  const [other] = await sql`select id from students where name = 'Ana Souza' limit 1`;
  expect((await t.goto(`/app/notas/aluno/${other.id}?turma=00000000-0000-4000-8000-000000000000`))?.status()).toBe(404);

  // a aba Notas da turma continua funcionando
  await t.goto(`/app/turmas/${turmaA}/notas`);
  await expect(t.getByLabel("Ana Souza — Prova 1")).toHaveValue("9");
});
