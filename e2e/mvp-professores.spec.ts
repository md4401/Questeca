import { test, expect as baseExpect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signup, createClass, addStudents, sql, pdfText } from "./helpers";
import { signCard } from "../src/lib/core/card-token";
import { nowInSP } from "../src/lib/core/lesson-now";

const expect = baseExpect.configure({ soft: true, timeout: 10000 });
const SECRET = process.env.AUTH_SECRET ?? "dev-secret-change-me";

async function audit(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(`A11Y ${name}:`, bad.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target?.join(" ")}`).join(" | "));
  expect(bad, `${name}: ${bad.map((v) => v.id).join(", ")}`).toEqual([]);
}
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

test("MVP professores: Aula de Agora (2 escolas), plano de aula, parecer descritivo, QR do cartão → nota à escola, radar de risco", async ({ browser }) => {
  test.setTimeout(290_000);
  const tctx = await browser.newContext(); const t = await tctx.newPage();
  const temail = await signup(t, { name: "Professora Multi" });
  const [tu] = await sql`select id from users where email = ${temail}`;
  const [orgA] = await sql`select org_id from memberships where user_id = ${tu.id}`;
  await sql`update subscriptions set plan = 'teacher' where org_id = ${orgA.org_id}`;
  const A = orgA.org_id as string;

  // coordenadora na escola A (recebe os avisos)
  const cctx = await browser.newContext(); const c = await cctx.newPage();
  const cemail = await signup(c, { name: "Coordenadora Aviso" });
  const [cu] = await sql`select id from users where email = ${cemail}`;
  await sql`insert into memberships (org_id, user_id, role) values (${A}, ${cu.id}, 'coordinator')`;

  const classA = await createClass(t, "9º A");
  await addStudents(t, classA, "Iara Dias;11\nJoão Reis;12\nLia Mota;13");
  const stud = async (n: string, org: string) => (await sql`select id from students where name = ${n} and org_id = ${org} limit 1`)[0].id as string;
  const iara = await stud("Iara Dias", A), joao = await stud("João Reis", A), lia = await stud("Lia Mota", A);

  // segunda escola (B): turma 7º C com aula acontecendo agora
  const [orgB] = await sql`insert into orgs (name, kind, owner_id) values ('Escola B', 'school', ${tu.id}) returning id`;
  const B = orgB.id as string;
  await sql`insert into memberships (org_id, user_id, role) values (${B}, ${tu.id}, 'teacher')`;
  const [clsB] = await sql`insert into classes (org_id, name, grade, subject, year, created_by) values (${B}, '7º C', '7', 'matematica', 2026, ${tu.id}) returning id`;
  await sql`insert into class_teachers (class_id, user_id) values (${clsB.id}, ${tu.id})`;
  for (const n of ["Kaio Lins", "Maya Cruz"]) {
    const [s] = await sql`insert into students (org_id, name) values (${B}, ${n}) returning id`;
    await sql`insert into enrollments (class_id, student_id) values (${clsB.id}, ${s.id})`;
  }
  const now = nowInSP(new Date());
  const start = Math.max(0, now.minutes - 10), end = Math.min(1439, now.minutes + 50);
  await sql`insert into timetable_slots (org_id, class_id, subject, teacher_id, weekday, start_time, end_time, room, created_by) values (${B}, ${clsB.id}, 'matematica', ${tu.id}, ${now.weekday}, ${hhmm(start)}, ${hhmm(end)}, '12', ${tu.id})`;
  // aula da escola A em outro dia: não aparece agora
  await sql`insert into timetable_slots (org_id, class_id, subject, teacher_id, weekday, start_time, end_time, created_by) values (${A}, ${classA}, 'matematica', ${tu.id}, ${now.weekday % 7 + 1}, '07:30', '08:20', ${tu.id})`;

  /* ---------- 4. Aula de Agora ---------- */
  console.log("STEP aula-agora");
  await t.goto("/app");
  const agora = t.getByTestId("aula-agora");
  await expect(agora).toContainText("Aula de agora");
  await expect(agora).toContainText("7º C");
  await expect(agora).toContainText("Escola B");
  await expect(agora).toContainText(`${hhmm(start)}–${hhmm(end)}`);
  await expect(agora).toContainText("Nenhum plano ainda");
  await agora.getByLabel("Falta: Kaio Lins").check();
  await agora.getByRole("button", { name: "Salvar chamada" }).click();
  await expect(t.getByText("Chamada salva.")).toBeVisible();
  await t.goto("/app");
  await expect(t.getByTestId("chamada-feita")).toContainText("1 presente(s), 1 falta(s)");
  const sess = await sql`select s.lesson, r.status from attendance_sessions s join attendance_records r on r.session_id = s.id where s.class_id = ${clsB.id} order by r.status`;
  expect(sess.map((x) => x.status)).toEqual(["absent", "present"]); expect(sess[0].lesson).toBe(hhmm(start));

  /* ---------- 2. Plano de aula ---------- */
  console.log("STEP plano");
  await t.goto("/app/planos-de-aula");
  await t.getByLabel("Tema da aula").fill("Porcentagem e descontos sucessivos");
  await t.getByLabel("Turma").selectOption({ label: "7º C — Escola B" });
  await t.getByRole("button", { name: "Gerar plano de aula" }).click();
  await t.waitForURL(/\/app\/planos-de-aula\/[0-9a-f-]{36}$/);
  const planId = t.url().split("/").pop()!;
  const plano = t.getByTestId("plano");
  for (const s of ["Plano de Aula", "Porcentagem e descontos sucessivos", "Escola B", "7º C", "Objetivos de aprendizagem", "Desenvolvimento", "Avaliação", "Adaptações e inclusão", "Porcentagem simples"]) await expect(plano).toContainText(s);
  const docx = await t.request.get(`/api/export/plano?id=${planId}`);
  expect(docx.status()).toBe(200); expect((await docx.body()).subarray(0, 2).toString()).toBe("PK");
  expect((await c.request.get(`/api/export/plano?id=${planId}`)).status()).toBe(404); // outra pessoa não acessa
  await t.getByText("Editar plano").click();
  await t.getByLabel("Objetivos (um por linha)").fill("Calcular descontos sucessivos sem erro.");
  await t.getByRole("button", { name: "Salvar plano" }).click();
  await expect(t.getByText("Plano salvo.")).toBeVisible();
  await t.reload();
  await expect(t.getByTestId("plano")).toContainText("Calcular descontos sucessivos sem erro.");
  await audit(t, "plano");
  await t.getByRole("button", { name: "Enviar à coordenação" }).click();
  await expect(t.getByText(/Enviado em/)).toBeVisible();
  expect((await sql`select sent_at from lesson_plans where id = ${planId}`)[0].sent_at).not.toBeNull();
  await t.goto("/app");
  await expect(t.getByTestId("aula-agora").getByRole("link", { name: "Porcentagem e descontos sucessivos" })).toBeVisible();

  /* ---------- 3. Parecer descritivo ---------- */
  console.log("STEP parecer");
  await t.goto(`/app/turmas/${classA}/observacoes`);
  await t.getByLabel("Sobre").selectOption(iara);
  await t.getByLabel("Participou bem").check({ force: true });
  await t.getByLabel("Dificuldade no conteúdo").check({ force: true });
  await t.getByLabel("Observação", { exact: true }).fill("Foi à lousa na aula de frações.");
  await t.getByRole("button", { name: "Salvar observação" }).click();
  await expect(t.getByText("Observação salva.")).toBeVisible();
  await t.getByLabel("Sobre").selectOption(joao);
  await t.getByLabel("Ajudou colegas").check({ force: true });
  await t.getByRole("button", { name: "Salvar observação" }).click();
  await expect(t.getByText("Observação salva.")).toBeVisible();
  await t.goto(`/app/turmas/${classA}/frequencia`);
  await t.getByTestId("abrir-chamada").click();
  await t.locator("fieldset", { hasText: "Iara Dias" }).locator('[data-st="absent"]').click();
  await t.getByRole("button", { name: "Salvar chamada" }).click();
  await expect(t.getByText("Chamada salva.")).toBeVisible();
  await t.goto(`/app/turmas/${classA}/pareceres`);
  await audit(t, "pareceres");
  await t.getByRole("button", { name: /Gerar rascunhos de/ }).click();
  await expect(t.getByText(/2 rascunho\(s\) gerado\(s\)/)).toBeVisible();
  await expect(t.getByText(/1 aluno\(s\) sem registros no mês/)).toBeVisible();
  const iaraBox = t.getByLabel("Parecer de Iara Dias");
  await expect(iaraBox).toHaveValue(/Iara participou ativamente das aulas/);
  await expect(iaraBox).toHaveValue(/Por outro lado, Iara demonstrou dificuldade/);
  await expect(iaraBox).toHaveValue(/Foi à lousa na aula de frações/);
  await expect(iaraBox).toHaveValue(/frequência de 0%/);
  await expect(t.getByLabel("Parecer de João Reis")).toHaveValue(/João colaborou com os colegas/);
  await expect(t.getByLabel("Parecer de Lia Mota")).toHaveValue("");
  await iaraBox.fill(`${await iaraBox.inputValue()} Ótima evolução em sala.`);
  await t.getByTestId("parecer-item").filter({ hasText: "Iara Dias" }).getByRole("button", { name: "Aprovar" }).click();
  await expect(t.getByText("Parecer aprovado.")).toBeVisible();
  await t.getByRole("button", { name: /Gerar rascunhos de/ }).click(); // regerar não sobrescreve o aprovado
  await expect(t.getByText(/mantido\(s\)/)).toBeVisible();
  await t.reload();
  await expect(t.getByLabel("Parecer de Iara Dias")).toHaveValue(/Ótima evolução em sala\./);
  expect((await sql`select status, origin from descriptive_opinions where student_id = ${iara}`)[0]).toMatchObject({ status: "approved", origin: "manual" });
  const pdoc = await t.request.get(`/api/export/pareceres?turma=${classA}&mes=${new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7)}`);
  expect(pdoc.status()).toBe(200); expect((await pdoc.body()).subarray(0, 2).toString()).toBe("PK");

  /* ---------- 1. QR no cartão → nota à escola ---------- */
  console.log("STEP qr");
  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const [app] = await sql`insert into applications (org_id, class_id, kind, title, applied_on, external) values (${A}, ${classA}, 'external', 'Prova de Porcentagem', ${today}, ${JSON.stringify({ answerKey: ["A", "B", "C"], points: [3, 3, 4] })}::jsonb) returning id`;
  const txt = await pdfText(t.request, `/api/export/cartao?app=${app.id}`);
  expect(txt).toContain("Escaneie para enviar a nota"); expect(txt).toContain("Lia Mota");
  const token = signCard(app.id, lia, SECRET);
  const bad = await t.goto(`/app/g/${token.slice(0, -2)}xx`);
  expect(bad?.status()).toBe(404);
  await t.goto("/app/escanear");
  await audit(t, "escanear");
  await t.getByLabel("Link ou código do cartão").fill(`http://localhost:3100/app/g/${token}`);
  await t.getByRole("button", { name: "Abrir cartão" }).click();
  await t.waitForURL(/\/app\/g\//);
  await expect(t.getByTestId("cartao-aluno")).toHaveText("Lia Mota");
  await t.getByLabel("Questão 1").selectOption("A");
  await t.getByLabel("Questão 2").selectOption("B");
  await t.getByLabel("Questão 3").selectOption("");
  await audit(t, "cartao-qr");
  await t.getByRole("button", { name: "Corrigir e enviar nota à escola" }).click();
  await expect(t.getByText("Nota enviada à escola: Lia Mota — 6 de 10.")).toBeVisible();
  let sub = (await sql`select value, max_points from grade_submissions where student_id = ${lia}`)[0];
  expect([Number(sub.value), Number(sub.max_points)]).toEqual([6, 10]);
  expect(Number((await sql`select g.value from grades g join grade_items i on i.id = g.grade_item_id where i.application_id = ${app.id} and g.student_id = ${lia}`)[0].value)).toBe(6);
  await t.reload();
  await expect(t.getByTestId("ja-enviada")).toContainText("6/10");
  await t.getByLabel("Questão 3").selectOption("C");
  await t.getByRole("button", { name: "Corrigir e enviar nota à escola" }).click();
  await expect(t.getByText("Nota enviada à escola: Lia Mota — 10 de 10.")).toBeVisible();
  sub = (await sql`select value from grade_submissions where student_id = ${lia}`)[0];
  expect(Number(sub.value)).toBe(10);
  expect((await sql`select count(*)::int n from grade_submissions where application_id = ${app.id}`)[0].n).toBe(1);
  expect((await sql`select count(*)::int n from grade_changes c join grade_items i on i.id = c.grade_item_id where i.application_id = ${app.id}`)[0].n).toBe(2);
  expect((await sql`select count(*)::int n from notifications where user_id = ${cu.id} and title = 'Notas recebidas'`)[0].n).toBe(1);
  await t.goto("/app");
  await expect(t.getByTestId("notas-qr")).toContainText("Lia Mota");
  // outro usuário (sem vínculo com a turma) não abre o cartão
  const other = await browser.newContext(); const o = await other.newPage(); await signup(o, { name: "Intrusa" });
  expect((await o.goto(`/app/g/${token}`))?.status()).toBe(404);
  await other.close();

  /* ---------- 5. Radar ---------- */
  console.log("STEP radar");
  for (const [i, v] of [8, 8, 3].entries()) {
    const [it] = await sql`insert into grade_items (class_id, title, period, created_at) values (${classA}, ${"Teste " + i}, '1º bimestre', now() + ${i + 1} * interval '1 minute') returning id`;
    await sql`insert into grades (grade_item_id, student_id, value, state, source) values (${it.id}, ${joao}, ${v}, 'value', 'manual')`;
  }
  for (const back of [2, 1]) {
    const d = new Date(Date.now() - 3 * 3600e3 - back * 864e5).toISOString().slice(0, 10);
    const [s] = await sql`insert into attendance_sessions (org_id, class_id, subject, date, taken_by) values (${A}, ${classA}, 'matematica', ${d}, ${tu.id}) returning id`;
    for (const [sid, st] of [[iara, "absent"], [joao, "present"], [lia, "present"]]) await sql`insert into attendance_records (session_id, student_id, status) values (${s.id}, ${sid}, ${st})`;
  }
  await t.goto("/app/radar");
  await audit(t, "radar");
  const rows = t.getByTestId("radar-row");
  await expect(rows.filter({ hasText: "João Reis" })).toContainText("Queda de nota: de 8 (média anterior) para 3.");
  await expect(rows.filter({ hasText: "Iara Dias" })).toContainText("3 faltas seguidas.");
  await expect(rows.filter({ hasText: "Lia Mota" })).toHaveCount(0);
  await expect(rows.filter({ hasText: "Kaio Lins" })).toHaveCount(0);
  await rows.filter({ hasText: "João Reis" }).getByPlaceholder("Observação (opcional)").fill("Conversar com a família.");
  await rows.filter({ hasText: "João Reis" }).getByRole("button", { name: "Avisar coordenação" }).click();
  await expect(t.getByText("Coordenação avisada (1 pessoa(s)).")).toBeVisible();
  const al = (await sql`select reasons, note, notified from risk_alerts where student_id = ${joao}`)[0];
  expect(al.notified).toBe(1); expect(al.note).toBe("Conversar com a família."); expect(JSON.stringify(al.reasons)).toContain("Queda de nota");
  expect((await sql`select count(*)::int n from notifications where user_id = ${cu.id} and title = 'Aluno em atenção'`)[0].n).toBe(1);
  await t.reload();
  await expect(t.getByTestId("radar-row").filter({ hasText: "João Reis" })).toContainText("Coordenação avisada em");
  await t.goto("/app");
  await expect(t.getByTestId("radar-home")).toHaveCount(0); // radar fora do Início
  await audit(t, "inicio");
  // a coordenação vê o radar da escola A e recebe o aviso
  await c.goto("/app/radar");
  await expect(c.getByTestId("radar-row").filter({ hasText: "João Reis" })).toBeVisible();
});
