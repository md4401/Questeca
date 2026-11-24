import { test, expect as baseExpect } from "@playwright/test";
import { signup, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 12000 });

test("Frequência: página própria com chamada, frequência dos alunos e painel pedagógico; regras de nota em Notas; Escola sem esses cartões", async ({ page: t }) => {
  test.setTimeout(120_000);
  const email = await signup(t);
  await sql`update users set onboarding_done_at = now() where email = ${email}`;
  const [u] = await sql`select u.id, m.org_id from users u join memberships m on m.user_id = u.id where u.email = ${email} limit 1`;
  const mk = async (nome: string) => { const [c] = await sql`insert into classes (org_id, name, grade, subject, year, created_by) values (${u.org_id}, ${nome}, '9', 'matematica', 2026, ${u.id}) returning id`; await sql`insert into class_teachers (class_id, user_id) values (${c.id}, ${u.id})`; return c.id as string; };
  const turmaA = await mk("9º A"); const turmaB = await mk("9º B");
  const alunos: Record<string, string> = {};
  for (const n of ["Ana Souza", "Bruno Dias"]) { const [s] = await sql`insert into students (org_id, name) values (${u.org_id}, ${n}) returning id`; alunos[n] = s.id; await sql`insert into enrollments (class_id, student_id, status) values (${turmaA}, ${s.id}, 'active')`; }

  // a tela Escola não tem mais o ambiente institucional, as regras de nota nem o painel pedagógico
  await t.goto("/app/escola");
  await expect(t.getByRole("heading", { name: "Criar ambiente institucional" })).toHaveCount(0);
  await expect(t.getByRole("heading", { name: "Regras de nota" })).toHaveCount(0);
  await expect(t.getByRole("heading", { name: "Painel pedagógico" })).toHaveCount(0);

  // menu: Frequência entre Notas e Provas
  await t.goto("/app");
  await expect(t.locator("aside.side").getByRole("link", { name: "Frequência" })).toBeVisible();
  await t.locator("aside.side").getByRole("link", { name: "Frequência" }).click();
  await t.waitForURL(/\/app\/frequencia/);
  await expect(t.getByRole("heading", { name: "Frequência", level: 1 })).toBeVisible();

  // chamada da turma A: Ana presente, Bruno ausente
  await t.getByLabel("Turma").selectOption(turmaA);
  await t.getByRole("button", { name: "Abrir" }).first().click();
  await expect(t.getByRole("heading", { name: "Chamada" })).toBeVisible();
  await t.getByRole("group", { name: "Bruno Dias" }).getByText("Falta", { exact: true }).click();
  await t.getByRole("button", { name: "Salvar chamada" }).click();
  await expect(t.getByText("Chamada salva.")).toBeVisible();
  const lista = t.getByRole("region", { name: /Frequência da turma/ }).or(t.locator("section", { hasText: "Frequência da turma" }));
  await expect(lista.getByText("Bruno Dias").first()).toBeVisible();
  await expect(lista.getByText("abaixo do mínimo")).toHaveCount(1); // só o Bruno (0%)
  await expect(t.getByRole("img", { name: "Frequência de Ana Souza: 100%" })).toBeVisible();

  // painel pedagógico: limites editáveis aqui; com mínimo 0% ninguém fica abaixo
  await expect(t.getByRole("heading", { name: "Painel pedagógico" })).toBeVisible();
  await t.getByLabel("Frequência mínima (%)").fill("0");
  await t.getByRole("button", { name: "Salvar regras do painel" }).click();
  await expect(t.getByText("Regras do painel salvas.")).toBeVisible();
  await t.goto(`/app/frequencia?turma=${turmaA}`);
  await expect(t.getByText("abaixo do mínimo")).toHaveCount(0);

  // trocar de turma mostra a outra (sem alunos)
  await t.goto(`/app/frequencia?turma=${turmaB}`);
  await expect(t.getByText(/Cadastre alunos para fazer a chamada/)).toBeVisible();

  // a rota antiga da turma continua funcionando com o mesmo painel
  await t.goto(`/app/turmas/${turmaA}/frequencia`);
  await expect(t.getByRole("heading", { name: "Chamada" })).toBeVisible();

  // regras de nota agora na página Notas
  await t.goto(`/app/notas?turma=${turmaA}`);
  await expect(t.getByRole("heading", { name: "Regras de nota" })).toBeVisible();
  await t.getByLabel("Média de aprovação").fill("5");
  await t.getByRole("button", { name: "Salvar regras", exact: true }).click();
  await expect(t.getByText(/Regras salvas/)).toBeVisible();
  const [o] = await sql`select settings from orgs where id = ${u.org_id}`;
  expect(o.settings.grading.passMark).toBe(5);
  expect(o.settings.risk.minAttendance).toBe(0);
});
