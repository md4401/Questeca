import { test, expect as baseExpect } from "@playwright/test";
import { signup, createClass, addStudents, sql, pdfText } from "./helpers";

const expect = baseExpect.configure({ soft: true, timeout: 10000 });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAH0bC7wAAAABJRU5ErkJggg==", "base64");

test("Versão professores: chamada, agenda e horários, gestão, boletim, painel, mensagens entre colegas, perfil e tema; sem nada de aluno", async ({ browser }) => {
  test.setTimeout(290_000);
  const ctx = await browser.newContext(); const t = await ctx.newPage();
  const temail = await signup(t, { name: "Coordenadora Prof" });
  await sql`update subscriptions set plan = 'teacher' where org_id in (select m.org_id from memberships m join users u on u.id = m.user_id where u.email = ${temail})`;
  const classA = await createClass(t, "9º A");
  const classB = await createClass(t, "9º B");
  await addStudents(t, classA, "Iara Dias;11\nJoão Reis;12");
  await addStudents(t, classB, "Kaio Lins;21");
  const [tu] = await sql`select id from users where email = ${temail}`;
  const [org] = await sql`select m.org_id from memberships m where m.user_id = ${tu.id}`;
  const stud = async (name: string) => (await sql`select id from students where name = ${name} and org_id = ${org.org_id} limit 1`)[0].id as string;
  const iara = await stud("Iara Dias"); const joao = await stud("João Reis");

  /* ---------- Nada de portal, quiz, tarefas, mural de turma ou gamificação ---------- */
  console.log("STEP ausentes");
  for (const p of ["/portal", "/acesso/qualquer", `/app/turmas/${classA}/tarefas`, `/app/turmas/${classA}/quizzes`, `/app/turmas/${classA}/mural`, `/app/turmas/${classA}/acessos`, `/app/turmas/${classA}/engajamento`, "/app/videoaulas"]) {
    expect((await t.request.get(p)).status(), p).toBe(404);
  }
  await t.goto(`/app/turmas/${classA}`);
  for (const nome of ["Tarefas", "Quizzes", "Mural", "Acessos", "Engajamento"]) await expect(t.getByRole("link", { name: nome, exact: true })).toHaveCount(0);

  /* ---------- Frequência ---------- */
  console.log("STEP frequencia");
  await t.goto(`/app/turmas/${classA}/frequencia`);
  await t.getByLabel("Falta: Iara Dias").check({ force: true });
  await t.getByRole("button", { name: "Salvar chamada" }).click();
  await expect(t.getByText("Chamada salva.")).toBeVisible();
  await t.goto(`/app/turmas/${classA}/frequencia`);
  await t.getByLabel("Justificada: Iara Dias").check({ force: true });
  await t.getByRole("button", { name: "Salvar correção" }).click();
  await expect(t.getByText(/informe o motivo da correção/i)).toBeVisible();
  await t.getByLabel("Motivo da correção").fill("Atestado entregue");
  await t.getByRole("button", { name: "Salvar correção" }).click();
  await expect(t.getByText("Chamada salva.")).toBeVisible();
  await t.reload();
  await expect(t.getByText(/Histórico de correções \(1\)/)).toBeVisible();
  expect((await sql`select count(*)::int n from attendance_sessions where class_id = ${classA}`)[0].n).toBe(1);

  /* ---------- Agenda e horários ---------- */
  console.log("STEP agenda");
  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const until = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  await t.goto("/app/agenda");
  await t.getByRole("button", { name: "Adicionar evento" }).click();
  await t.getByLabel("Título").fill("Reunião pedagógica");
  await t.getByLabel("Para quem").selectOption("personal");
  await t.getByLabel("Data").fill(today);
  await t.locator("#startTime").fill("23:00");
  await t.getByLabel("Repetir").selectOption("weekly");
  await t.getByLabel("Até").fill(until);
  await t.getByRole("button", { name: "Criar evento" }).click();
  await expect(t.getByText("Evento criado.")).toBeVisible();
  await t.goto("/app/agenda");
  await expect(t.getByText("Reunião pedagógica").first()).toBeVisible();
  await t.goto("/app/horarios");
  await t.locator("#startTime").fill("08:00"); await t.locator("#endTime").fill("08:50");
  await t.getByLabel("Sala (opcional)").fill("Sala 3");
  await t.getByRole("button", { name: "Adicionar horário" }).click();
  await expect(t.getByText("Horário adicionado.")).toBeVisible();
  await t.locator("#startTime").fill("08:30"); await t.locator("#endTime").fill("09:20");
  await t.getByRole("button", { name: "Adicionar horário" }).click();
  await expect(t.getByText(/Conflito de horário/)).toBeVisible();

  /* ---------- Gestão acadêmica (coordenação) ---------- */
  console.log("STEP gestao");
  await sql`update memberships set role = 'coordinator' where user_id = ${tu.id}`;
  await t.goto("/app/gestao");
  await t.getByLabel("Buscar aluno").fill("joão");
  await t.getByRole("button", { name: "Buscar" }).click();
  await expect(t.getByText("João Reis").first()).toBeVisible();
  await t.getByText("Editar ou transferir").click();
  await t.getByLabel("Da turma").selectOption({ label: "9º A" });
  await t.getByLabel("Para a turma").selectOption({ label: "9º B · 9º ano · " + new Date().getFullYear() });
  await t.getByLabel("Motivo (opcional)").fill("Mudança de turno");
  await t.getByRole("button", { name: "Transferir" }).click();
  await expect(t.getByText(/agora está em 9º B/)).toBeVisible();
  const en = await sql`select class_id, status from enrollments where student_id = ${joao}`;
  expect(en.map((e) => `${e.class_id === classB ? "B" : "A"}:${e.status}`).sort()).toEqual(["A:transferred", "B:active"]);
  await expect(t.getByText(/Convites de acesso/)).toHaveCount(0);

  /* ---------- Boletim em PDF e painel ---------- */
  console.log("STEP boletim");
  const [gi1] = await sql`insert into grade_items (class_id, title, category, period, weight, max_points) values (${classA}, 'Prova 1', 'prova', '1º bimestre', 1, 10) returning id`;
  const [gi2] = await sql`insert into grade_items (class_id, title, category, period, weight, max_points) values (${classA}, 'Trabalho', 'trabalho', '1º bimestre', 1, 10) returning id`;
  await sql`insert into grades (grade_item_id, student_id, value, state) values (${gi1.id}, ${iara}, 4, 'value'), (${gi2.id}, ${iara}, null, 'not_delivered')`;
  const [s2] = await sql`insert into attendance_sessions (org_id, class_id, subject, date, lesson, taken_by) values (${org.org_id}, ${classA}, 'matematica', '2026-02-03', '', ${tu.id}) returning id`;
  await sql`insert into attendance_records (session_id, student_id, status) values (${s2.id}, ${iara}, 'present')`;
  await sql`insert into observations (class_id, student_id, author_id, text, visibility, observed_on) values (${classA}, ${iara}, ${tu.id}, 'Participa bem das aulas em grupo.', 'family', '2026-02-05'), (${classA}, ${iara}, ${tu.id}, 'Nota interna da coordenação.', 'private', '2026-02-05')`;
  await t.goto(`/app/turmas/${classA}/boletins`);
  await t.getByLabel("Período de Iara Dias").selectOption("1º bimestre");
  await t.getByRole("listitem").filter({ hasText: "Iara Dias" }).getByRole("button", { name: "Gerar boletim" }).click();
  await expect(t.getByText(/Boletim gerado/)).toBeVisible();
  await expect(t.getByRole("button", { name: /Publicar/ })).toHaveCount(0);
  const [rc] = await sql`select id from report_cards where student_id = ${iara} order by created_at desc limit 1`;
  const txt = await pdfText(t.request, `/api/boletim/${rc.id}`);
  expect(txt).toContain("Iara Dias"); expect(txt).toContain("Média do período"); expect(txt).toContain("Prova 1: 4"); expect(txt).toContain("Trabalho: N");
  expect(txt).toContain("Participa bem das aulas em grupo."); expect(txt).not.toContain("Nota interna"); expect(txt).toMatch(/Cálculo:/);
  console.log("STEP painel");
  await t.goto(`/app/turmas/${classA}/analitico`);
  await expect(t.getByRole("row", { name: /Iara Dias/ })).toContainText(/Média 2 abaixo de 6/);
  await expect(t.getByText(/apoio/).first()).toBeVisible();
  await t.goto("/app/frequencia");
  await t.getByLabel("Frequência mínima (%)").fill("40");
  await t.getByLabel("Média mínima").fill("1");
  await t.getByRole("button", { name: "Salvar regras do painel" }).click();
  await expect(t.getByText("Regras do painel salvas.")).toBeVisible();
  await t.goto(`/app/turmas/${classA}/analitico`);
  await expect(t.getByRole("row", { name: /Iara Dias/ })).toContainText("Sem alerta");

  /* ---------- Mensagens entre colegas ---------- */
  console.log("STEP chat");
  await t.goto("/app/chat");
  await expect(t.getByLabel("Conversar com")).toHaveCount(0); // sozinho na escola: sem contatos
  await expect(t.getByText(/Ninguém disponível/)).toBeVisible();

  /* ---------- Perfil e tema ---------- */
  console.log("STEP perfil");
  await t.goto("/app/conta");
  await t.getByLabel("Escuro").check({ force: true });
  await expect.poll(async () => (await sql`select prefs->>'theme' as th from users where id = ${tu.id}`)[0].th).toBe("dark");
  await t.reload();
  await expect(t.locator("html")).toHaveAttribute("data-theme", "dark");
  await t.getByLabel("Claro").check({ force: true });
  await t.getByLabel("Escolher imagem").setInputFiles({ name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>") });
  await t.getByRole("button", { name: "Salvar foto" }).click();
  await expect(t.getByText("Use PNG, JPG ou WebP.")).toBeVisible();
  await t.getByLabel("Escolher imagem").setInputFiles({ name: "eu.png", mimeType: "image/png", buffer: PNG });
  await t.getByRole("button", { name: "Salvar foto" }).click();
  await expect(t.getByText("Foto atualizada.")).toBeVisible();
  expect((await t.request.get(`/api/avatar/${tu.id}`)).status()).toBe(200);
});
