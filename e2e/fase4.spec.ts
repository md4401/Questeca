import { test, expect as baseExpect } from "@playwright/test";
import { signup, createClass, addStudents, sql, inviteLink, portalAccount, pdfText } from "./helpers";

const expect = baseExpect.configure({ soft: true, timeout: 10000 });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAH0bC7wAAAABJRU5ErkJggg==", "base64");

test("Fase 4: gestão acadêmica, boletim, painel pedagógico, perfil e tema", async ({ browser }) => {
  test.setTimeout(290_000);
  const tctx = await browser.newContext(); const t = await tctx.newPage();
  const temail = await signup(t, { name: "Coordenadora Fase4" });
  await sql`update subscriptions set plan = 'teacher' where org_id in (select m.org_id from memberships m join users u on u.id = m.user_id where u.email = ${temail})`;
  const classA = await createClass(t, "9º A");
  const classB = await createClass(t, "9º B");
  await addStudents(t, classA, "Iara Dias;11\nJoão Reis;12");
  await addStudents(t, classB, "Kaio Lins;21");
  const [tu] = await sql`select id from users where email = ${temail}`;
  const [org] = await sql`select m.org_id from memberships m where m.user_id = ${tu.id}`;
  const stud = async (name: string) => (await sql`select id from students where name = ${name} and org_id = ${org.org_id} limit 1`)[0].id as string;
  const iara = await stud("Iara Dias"); const joao = await stud("João Reis"); const kaio = await stud("Kaio Lins");
  const g = await portalAccount(browser, await inviteLink(t, classA, "Iara Dias", "guardian"), "Rosa Dias");
  const g2 = await portalAccount(browser, await inviteLink(t, classB, "Kaio Lins", "guardian"), "Lia Lins");
  await inviteLink(t, classA, "João Reis", "guardian"); // fica pendente
  await sql`update memberships set role = 'coordinator' where user_id = ${tu.id}`; // coordenação da unidade

  /* ---------- Gestão acadêmica ---------- */
  console.log("STEP gestao");
  await t.goto("/app/gestao");
  await expect(t.getByRole("heading", { name: "Gestão acadêmica" })).toBeVisible();
  await t.getByLabel("Buscar aluno").fill("joão");
  await t.getByRole("button", { name: "Buscar" }).click();
  await expect(t.getByText("João Reis").first()).toBeVisible(); await expect(t.getByText("Iara Dias")).toHaveCount(0);
  await t.getByText("Editar ou transferir").click();
  await t.getByLabel("Matrícula", { exact: true }).fill("12-A");
  await t.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(t.getByText("Cadastro atualizado.")).toBeVisible();
  await t.getByLabel("Da turma").selectOption({ label: "9º A" });
  await t.getByLabel("Para a turma").selectOption({ label: "9º B · 9º ano · " + new Date().getFullYear() });
  await t.getByLabel("Motivo (opcional)").fill("Mudança de turno");
  await t.getByRole("button", { name: "Transferir" }).click();
  await expect(t.getByText(/agora está em 9º B/)).toBeVisible();
  const en = await sql`select class_id, status from enrollments where student_id = ${joao} order by status`;
  expect(en.map((e) => `${e.class_id === classB ? "B" : "A"}:${e.status}`).sort()).toEqual(["A:transferred", "B:active"]);
  expect((await sql`select count(*)::int n from enrollment_history where student_id = ${joao} and reason = 'Mudança de turno'`)[0].n).toBe(1);
  await t.goto("/app/gestao");
  await expect(t.getByText(/9º A → 9º B/)).toBeVisible();
  await expect(t.getByText("João Reis · responsável")).toBeVisible(); // convite pendente
  await t.getByRole("button", { name: /Revogar convite de João Reis/ }).click();
  await expect(t.getByText("João Reis · responsável")).toHaveCount(0);
  await t.getByRole("button", { name: /Criar 9º A para / }).first().click();
  await expect.poll(async () => (await sql`select count(*)::int n from classes where org_id = ${org.org_id} and name = '9º A' and year = ${new Date().getFullYear() + 1}`)[0].n).toBe(1);

  /* ---------- Dados pedagógicos para o boletim e o painel ---------- */
  const [gi1] = await sql`insert into grade_items (class_id, title, category, period, weight, max_points) values (${classA}, 'Prova 1', 'prova', '1º bimestre', 1, 10) returning id`;
  const [gi2] = await sql`insert into grade_items (class_id, title, category, period, weight, max_points) values (${classA}, 'Trabalho', 'trabalho', '1º bimestre', 1, 10) returning id`;
  await sql`insert into grades (grade_item_id, student_id, value, state) values (${gi1.id}, ${iara}, 4, 'value'), (${gi2.id}, ${iara}, null, 'not_delivered')`;
  const [sess1] = await sql`insert into attendance_sessions (org_id, class_id, subject, date, lesson, taken_by) values (${org.org_id}, ${classA}, 'matematica', '2026-02-02', '', ${tu.id}) returning id`;
  const [sess2] = await sql`insert into attendance_sessions (org_id, class_id, subject, date, lesson, taken_by) values (${org.org_id}, ${classA}, 'matematica', '2026-02-03', '', ${tu.id}) returning id`;
  await sql`insert into attendance_records (session_id, student_id, status) values (${sess1.id}, ${iara}, 'present'), (${sess2.id}, ${iara}, 'absent')`;
  await sql`insert into observations (class_id, student_id, author_id, text, visibility, observed_on) values (${classA}, ${iara}, ${tu.id}, 'Participa bem das aulas em grupo.', 'family', '2026-02-05'), (${classA}, ${iara}, ${tu.id}, 'Nota interna da coordenação.', 'private', '2026-02-05')`;

  /* ---------- Boletim ---------- */
  console.log("STEP boletim");
  await t.goto(`/app/turmas/${classA}/boletins`);
  await t.getByRole("row", { name: /x/ }).first(); // garante carregamento
  await t.getByLabel("Período de Iara Dias").selectOption("1º bimestre");
  await t.getByRole("listitem").filter({ hasText: "Iara Dias" }).getByRole("button", { name: "Gerar boletim" }).click();
  await expect(t.getByText(/Boletim gerado/)).toBeVisible();
  const [rc] = await sql`select id, published from report_cards where student_id = ${iara} order by created_at desc limit 1`;
  expect(rc.published).toBe(false);
  expect((await g.page.request.get(`/api/boletim/${rc.id}`)).status()).toBe(404); // ainda não publicado
  await g.page.goto("/portal/boletim");
  await expect(g.page.getByText(/Nenhum boletim publicado/)).toBeVisible();
  await t.getByRole("button", { name: /Publicar boletim 1º bimestre de Iara Dias/ }).click();
  await expect(t.getByRole("button", { name: /Despublicar boletim/ })).toBeVisible();
  await g.page.goto("/portal/boletim");
  await expect(g.page.getByText("1º bimestre")).toBeVisible();
  const txt = await pdfText(g.page.request, `/api/boletim/${rc.id}`);
  expect(txt).toContain("Iara Dias"); expect(txt).toContain("Média do período"); expect(txt).toContain("Prova 1: 4"); expect(txt).toContain("Trabalho: N");
  expect(txt).toContain("Frequência: 50%"); expect(txt).toContain("Participa bem das aulas em grupo."); expect(txt).not.toContain("Nota interna");
  expect(txt).toMatch(/Cálculo:/);
  expect((await g2.page.request.get(`/api/boletim/${rc.id}`)).status()).toBe(404); // responsável de outro estudante
  expect((await t.request.get(`/api/boletim/${rc.id}`)).status()).toBe(200);

  /* ---------- Painel pedagógico ---------- */
  console.log("STEP painel");
  await t.goto(`/app/turmas/${classA}/analitico`);
  const rowIara = t.getByRole("row", { name: /Iara Dias/ });
  await expect(rowIara).toContainText("Alerta");
  await expect(rowIara).toContainText(/Frequência 50%/);
  await expect(rowIara).toContainText(/Média 2 abaixo de 6/);
  await expect(t.getByText(/não são diagnóstico|Não são diagnóstico/i).first()).toBeVisible();
  await t.goto("/app/escola");
  await t.getByLabel("Frequência mínima (%)").fill("40");
  await t.getByLabel("Média mínima").fill("1");
  await t.getByRole("button", { name: "Salvar regras do portal" }).click();
  await expect(t.getByText("Regras do portal salvas.")).toBeVisible();
  await t.goto(`/app/turmas/${classA}/analitico`);
  await expect(t.getByRole("row", { name: /Iara Dias/ })).toContainText("Sem alerta"); // limites da escola mudam o sinal
  await g.page.goto("/portal/desempenho");
  await expect(g.page.getByText("Frequência:", { exact: false }).first()).toBeVisible();
  await expect(g.page.getByText(/Alerta|Atenção/)).toHaveCount(0); // família não recebe rótulo de risco
  void kaio;

  /* ---------- Perfil e tema ---------- */
  console.log("STEP perfil");
  await t.goto("/app/conta");
  await t.getByLabel("Escuro").check({ force: true });
  await expect.poll(async () => (await sql`select prefs->>'theme' as th from users where id = ${tu.id}`)[0].th).toBe("dark");
  await t.reload();
  await expect(t.locator("html")).toHaveAttribute("data-theme", "dark");
  await t.getByLabel("Claro").check({ force: true });
  await expect(t.locator("html")).toHaveAttribute("data-theme", "light");
  await t.getByLabel("Escolher imagem").setInputFiles({ name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>") });
  await t.getByRole("button", { name: "Salvar foto" }).click();
  await expect(t.getByText("Use PNG, JPG ou WebP.")).toBeVisible();
  await t.getByLabel("Escolher imagem").setInputFiles({ name: "falso.png", mimeType: "image/png", buffer: Buffer.from("isto não é uma imagem") });
  await t.getByRole("button", { name: "Salvar foto" }).click();
  await expect(t.getByText("Use PNG, JPG ou WebP.").first()).toBeVisible(); // o conteúdo manda, não o nome
  await t.getByLabel("Escolher imagem").setInputFiles({ name: "eu.png", mimeType: "image/png", buffer: PNG });
  await t.getByRole("button", { name: "Salvar foto" }).click();
  await expect(t.getByText("Foto atualizada.")).toBeVisible();
  expect((await t.request.get(`/api/avatar/${tu.id}`)).status()).toBe(200);
  expect((await g.page.request.get(`/api/avatar/${tu.id}`)).status()).toBe(404); // família não vê foto da equipe
  await g.page.goto("/portal/conta");
  await g.page.getByLabel("Nome", { exact: true }).fill("Rosa M. Dias");
  await g.page.getByRole("button", { name: "Salvar", exact: true }).first().click();
  await expect(g.page.getByText("Perfil salvo.")).toBeVisible();
  expect((await sql`select name from users where email = ${g.email}`)[0].name).toBe("Rosa M. Dias");
});
