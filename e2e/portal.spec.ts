import { test, expect, type Browser } from "@playwright/test";
import { signup, createClass, addStudents, sql, uid, PASSWORD } from "./helpers";

/** Professor com turma e dois alunos; devolve ids e ferramentas. */
async function setup(browser: Browser) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const email = await signup(page, { name: "Professora Portal" });
  const classId = await createClass(page, "8º A");
  await addStudents(page, classId, "Lia Prado;101\nTomás Reis;102");
  const students = await sql`select s.id, s.name from students s join enrollments e on e.student_id = s.id where e.class_id = ${classId} order by s.name`;
  return { ctx, page, email, classId, students };
}

async function invite(page: import("@playwright/test").Page, classId: string, studentName: string, kind: "guardian" | "student") {
  await page.goto(`/app/turmas/${classId}/acessos`);
  await page.getByLabel("Aluno").selectOption({ label: studentName });
  await page.getByLabel("Quem vai acessar").selectOption(kind);
  await page.getByRole("button", { name: "Gerar link" }).click();
  const msg = await page.locator("form [role=status] .ok, form .ok").first().innerText();
  return msg.match(/\/acesso\/[\w-]+/)![0];
}

test("portal: convite de uso único, isolamento por estudante, equipe protegida e notificações", async ({ browser }) => {
  test.setTimeout(150_000);
  const t = await setup(browser);
  const lia = t.students.find((s) => s.name === "Lia Prado")!; const tomas = t.students.find((s) => s.name === "Tomás Reis")!;

  // responsável de Lia + outro convite revogado
  const link = await invite(t.page, t.classId, "Lia Prado", "guardian");
  const revoked = await invite(t.page, t.classId, "Tomás Reis", "student");
  await t.page.goto(`/app/turmas/${t.classId}/acessos`);
  await t.page.getByRole("listitem").filter({ hasText: "Tomás Reis" }).getByRole("button", { name: "Revogar" }).click();
  await expect(t.page.getByRole("listitem").filter({ hasText: "Tomás Reis" })).toHaveCount(0);

  const g = await browser.newContext(); const gp = await g.newPage();
  await gp.goto(revoked);
  await expect(gp.getByRole("heading", { name: "Link indisponível" })).toBeVisible();

  await gp.goto(link);
  await expect(gp.getByText(/Lia Prado/)).toBeVisible();
  const gmail = `resp-${uid()}@test.questeca.dev`;
  await gp.getByLabel("Seu nome").fill("Marta Prado");
  await gp.getByLabel("E-mail").fill(gmail);
  await gp.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await gp.getByLabel(/Li e aceito/).check();
  await gp.getByRole("button", { name: "Criar acesso" }).click();
  await gp.waitForURL(/\/portal/);
  await expect(gp.getByRole("heading", { name: /Olá, Marta/ })).toBeVisible();
  await expect(gp.getByText("Acompanhando Lia Prado")).toBeVisible();
  await expect(gp.getByText("Tomás Reis")).toHaveCount(0);

  // link de uso único
  const g2 = await browser.newContext(); const g2p = await g2.newPage();
  await g2p.goto(link);
  await expect(g2p.getByRole("heading", { name: "Link indisponível" })).toBeVisible();

  // equipe protegida: área do professor, turma e exportações ficam fora do alcance
  await gp.goto("/app"); await expect(gp).toHaveURL(/\/portal/);
  await gp.goto(`/app/turmas/${t.classId}`); await expect(gp).toHaveURL(/\/portal/);
  expect((await g.request.get(`/api/export/notas?classId=${t.classId}`)).status()).toBeGreaterThanOrEqual(400);
  expect((await g.request.get("/api/export/escola")).status()).toBeGreaterThanOrEqual(400);
  expect((await g.request.get("/api/escolas?q=teste")).status()).toBe(401);

  // banco: papel e vínculo corretos, estudante só um
  const [u] = await sql`select id from users where email = ${gmail}`;
  const links = await sql`select student_id from guardian_links where user_id = ${u.id}`;
  expect(links.map((l) => l.student_id)).toEqual([lia.id]);
  const roles = await sql`select role from memberships where user_id = ${u.id}`;
  expect(roles.map((r) => r.role)).toEqual(["guardian"]);
  void tomas;

  // notificações: central, agrupamento, preferência por categoria e leitura
  await sql`insert into notifications (user_id, category, title, group_key) values (${u.id}, 'tarefa', 'Nova tarefa publicada', 'tarefa:x')`;
  await sql`insert into notifications (user_id, category, title, priority) values (${u.id}, 'sistema', 'Aviso importante da escola', 'high')`;
  await gp.goto("/portal/notificacoes");
  await expect(gp.getByText("Nova tarefa publicada")).toBeVisible();
  await expect(gp.getByText("Importante", { exact: true })).toBeVisible();
  await gp.getByRole("group", { name: "Filtros" }).getByRole("link", { name: "Tarefas", exact: true }).click();
  await expect(gp.getByText("Aviso importante da escola")).toHaveCount(0);
  await gp.getByRole("button", { name: /Marcar como lida: Nova tarefa/ }).click();
  await gp.getByRole("link", { name: "Só não lidas" }).click();
  await expect(gp.getByText("Nova tarefa publicada")).toHaveCount(0);
  await gp.goto("/portal/notificacoes");
  await gp.getByLabel("Tarefas").uncheck();
  await expect(gp.getByLabel("Segurança")).toBeDisabled();
  await gp.getByRole("button", { name: "Salvar preferências" }).click();
  await expect(gp.getByText("Preferências salvas.")).toBeVisible();
  const [pr] = await sql`select prefs from users where id = ${u.id}`;
  expect((pr.prefs as { mute: string[] }).mute).toContain("tarefa");
  expect((pr.prefs as { mute: string[] }).mute).not.toContain("seguranca");
});

test("aluno com conta própria vê só os próprios dados e duas escolas não se misturam", async ({ browser }) => {
  test.setTimeout(150_000);
  const a = await setup(browser); const b = await setup(browser);
  const lia = a.students.find((s) => s.name === "Lia Prado")!;
  const link = await invite(a.page, a.classId, "Lia Prado", "student");
  const s = await browser.newContext(); const sp = await s.newPage();
  await sp.goto(link);
  await sp.getByLabel("Seu nome").fill("Lia Prado");
  await sp.getByLabel("E-mail").fill(`aluna-${uid()}@test.questeca.dev`);
  await sp.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await sp.getByLabel(/Li e aceito/).check();
  await sp.getByRole("button", { name: "Criar acesso" }).click();
  await sp.waitForURL(/\/portal/);
  await expect(sp.getByText("8º A")).toBeVisible();
  // mesmo aluno não gera segunda conta de aluno
  await a.page.goto(`/app/turmas/${a.classId}/acessos`);
  await a.page.getByLabel("Aluno").selectOption({ label: "Lia Prado" });
  await a.page.getByLabel("Quem vai acessar").selectOption("student");
  await a.page.getByRole("button", { name: "Gerar link" }).click();
  await expect(a.page.getByText(/já tem conta/)).toBeVisible();
  // professor da outra escola não alcança nem a tela de acessos da turma de A
  await b.page.goto(`/app/turmas/${a.classId}/acessos`);
  await expect(b.page.getByText(/não encontrad|404|could not be found/i).first()).toBeVisible();
  // aluno tenta abrir ?aluno= de outro estudante: ignorado
  await sp.goto(`/portal?aluno=${(await sql`select id from students order by created_at desc limit 1`)[0].id}`);
  await expect(sp.getByText(lia.name as string).first()).toBeVisible();
  // revogar acesso encerra o portal
  await a.page.goto(`/app/turmas/${a.classId}/acessos`);
  await a.page.getByRole("button", { name: /Revogar acesso de Lia/ }).click();
  await expect(a.page.getByRole("button", { name: /Revogar acesso de Lia/ })).toHaveCount(0);
  await sp.goto("/portal");
  await expect(sp).not.toHaveURL(/\/portal$/);
});
