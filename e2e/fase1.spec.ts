import { test, expect as baseExpect } from "@playwright/test";
// asserções "soft": um passo que falha não esconde os seguintes (a suíte ainda falha no fim)
const expect = baseExpect.configure({ soft: true, timeout: 8000 });
import { signup, createClass, addStudents, sql, inviteLink, portalAccount } from "./helpers";

test("Fase 1: chamada, tarefas, notas, agenda e horários com portais", async ({ browser }) => {
  test.setTimeout(280_000);
  const tctx = await browser.newContext(); const t = await tctx.newPage();
  await signup(t, { name: "Professor Fase1" });
  const classId = await createClass(t, "7º C");
  await addStudents(t, classId, "Ana Lima;1\nBeto Souza;2\nCida Alves;3");
  const [guardLink, studLink, cidaLink] = [await inviteLink(t, classId, "Ana Lima", "guardian"), await inviteLink(t, classId, "Beto Souza", "student"), await inviteLink(t, classId, "Cida Alves", "guardian")];
  const g = await portalAccount(browser, guardLink, "Rita Lima");
  const s = await portalAccount(browser, studLink, "Beto Souza");
  const other = await portalAccount(browser, cidaLink, "Paulo Alves");

  /* ---------- Frequência ---------- */
  console.log("STEP requênci");
  await t.goto(`/app/turmas/${classId}/frequencia`);
  await expect(t.getByText(/Nova chamada de/)).toBeVisible();
  await t.getByLabel("Falta: Ana Lima").check({ force: true });
  await t.getByRole("button", { name: "Salvar chamada" }).click();
  await expect(t.getByText("Chamada salva.")).toBeVisible();
  await t.goto(`/app/turmas/${classId}/frequencia`); // reabre: agora é correção
  await expect(t.getByText(/já registrada/)).toBeVisible();
  await t.getByLabel("Justificada: Ana Lima").check({ force: true });
  await t.getByRole("button", { name: "Salvar correção" }).click();
  await expect(t.getByText(/informe o motivo da correção/i)).toBeVisible();
  await t.getByLabel("Motivo da correção").fill("Atestado entregue");
  await t.getByRole("button", { name: "Salvar correção" }).click();
  await expect(t.getByText("Chamada salva.")).toBeVisible();
  await t.reload();
  await expect(t.getByText(/Histórico de correções \(1\)/)).toBeVisible();
  const sess = await sql`select count(*)::int n from attendance_sessions where class_id = ${classId}`;
  expect(sess[0].n).toBe(1); // sem chamada duplicada
  // data futura é recusada
  await t.goto(`/app/turmas/${classId}/frequencia?data=2999-01-01`);
  await expect(t.getByRole("button", { name: /Salvar/ })).toBeVisible();
  // responsável vê a falta da Ana (não a de colegas) e o aviso da falta chegou
  await g.page.goto("/portal/frequencia");
  await expect(g.page.getByText("0%")).toBeVisible();
  await expect(g.page.getByText(/abaixo de 75%/)).toBeVisible();
  await expect(g.page.getByText(/Falta justificada/)).toBeVisible();
  const [gu] = await sql`select id from users where email = ${g.email}`;
  const freq = await sql`select count(*)::int n from notifications where user_id = ${gu.id} and category = 'frequencia'`;
  expect(freq[0].n).toBe(1);
  const [ou] = await sql`select id from users where email = ${other.email}`;
  expect((await sql`select count(*)::int n from notifications where user_id = ${ou.id} and category = 'frequencia'`)[0].n).toBe(0);

  /* ---------- Tarefas ---------- */
  console.log("STEP arefa");
  await t.goto(`/app/turmas/${classId}/tarefas`);
  await t.getByLabel("Título").fill("Lista de frações");
  await t.getByRole("button", { name: "+ Múltipla escolha" }).click();
  await t.getByLabel("Enunciado").first().fill("1/2 + 1/2 é igual a?");
  await t.getByLabel("Texto da alternativa A da questão 1").fill("1");
  await t.getByLabel("Texto da alternativa B da questão 1").fill("2");
  await t.getByRole("button", { name: "+ Discursiva" }).click();
  await t.getByLabel("Enunciado").nth(1).fill("Explique como você somou.");
  await t.getByLabel("Pontos").nth(1).fill("2");
  await t.getByRole("button", { name: "Criar rascunho" }).click();
  await t.waitForURL(/\/tarefas\/[0-9a-f-]{36}$/);
  const taskUrl = t.url();
  // rascunho não aparece para o aluno
  await s.page.goto("/portal/tarefas");
  await expect(s.page.getByText("Lista de frações")).toHaveCount(0);
  await t.getByRole("button", { name: "Publicar para a turma" }).click();
  await expect(t.getByRole("button", { name: "Encerrar tarefa" })).toBeVisible();
  const [su] = await sql`select id from users where email = ${s.email}`;
  expect((await sql`select count(*)::int n from notifications where user_id = ${su.id} and category = 'tarefa'`)[0].n).toBe(1);

  // guardião vê, mas não entrega
  await g.page.goto("/portal/tarefas");
  await g.page.getByRole("link", { name: "Lista de frações" }).click();
  await expect(g.page.getByText(/Somente o aluno envia/)).toBeVisible();
  // aluno entrega: múltipla escolha + discursiva
  await s.page.goto("/portal/tarefas");
  await s.page.getByRole("link", { name: "Lista de frações" }).click();
  await s.page.getByRole("button", { name: "Entregar" }).click();
  await expect(s.page.getByText(/antes de entregar/)).toBeVisible();
  await s.page.getByLabel("Resposta da questão 2").fill("Somei os numeradores.");
  await s.page.getByRole("button", { name: "Entregar" }).click();
  await expect(s.page.getByText(/Responda todas as questões de múltipla escolha/)).toBeVisible();
  await s.page.getByLabel("A) 1").check();
  await s.page.getByLabel(/Anexar arquivo/).setInputFiles({ name: "trabalho.txt", mimeType: "text/plain", buffer: Buffer.from("meu trabalho") });
  await s.page.getByRole("button", { name: "Entregar" }).click();
  await expect(s.page.getByText(/Entregue em/)).toBeVisible();
  await s.page.reload();
  await expect(s.page.getByText("Entregue", { exact: true }).first()).toBeVisible();
  // entrega única: não deixa reenviar
  await expect(s.page.getByText("Você já entregou esta tarefa.")).toBeVisible();
  console.log('STEP anexo');
  // anexo: o dono e a equipe baixam; responsável de outro aluno não
  const [att] = await sql`select a.id from task_attachments a join task_submissions ts on ts.id = a.submission_id where ts.student_id in (select student_id from student_accounts where user_id = ${su.id})`;
  expect((await s.page.request.get(`/api/anexo/${att.id}`)).status()).toBe(200);
  expect((await t.request.get(`/api/anexo/${att.id}`)).status()).toBe(200);
  expect((await other.page.request.get(`/api/anexo/${att.id}`)).status()).toBe(404);
  expect((await g.page.request.get(`/api/anexo/${att.id}`)).status()).toBe(404);

  console.log('STEP corrige');
  // professor corrige; aluno e responsável veem nota e devolutiva só depois
  await t.goto(taskUrl);
  await expect(t.getByText(/Auto: 1\/1 \+ discursivas/)).toBeVisible();
  await t.getByLabel("Nota de Beto Souza").fill("2,5");
  await t.getByLabel("Devolutiva para Beto Souza").fill("Bom raciocínio.");
  await t.getByRole("row", { name: /Beto Souza/ }).getByRole("button", { name: "Salvar" }).click();
  await expect(t.getByText("Correção salva.")).toBeVisible();
  await s.page.goto("/portal/tarefas");
  await s.page.getByRole("link", { name: "Lista de frações" }).click();
  await expect(s.page.getByText("Nota: 2,5 / 3")).toBeVisible();
  await expect(s.page.getByText("Bom raciocínio.")).toBeVisible();

  console.log('STEP caderno');
  // lançar no caderno: só o corrigido; sem entrega só vira N com a tarefa encerrada
  await t.getByRole("button", { name: "Lançar notas" }).click();
  await expect(t.getByText(/1 nota\(s\) lançada\(s\)/)).toBeVisible();
  await t.getByRole("button", { name: "Encerrar tarefa" }).click();
  await expect(t.getByRole("button", { name: "Encerrar tarefa" })).toHaveCount(0);
  await t.getByRole("button", { name: "Lançar notas" }).click();
  await expect(t.getByText(/3 nota\(s\) lançada\(s\)/)).toBeVisible();
  const gr = await sql`select g.state, g.value from grades g join students st on st.id = g.student_id where st.name = 'Ana Lima' and g.grade_item_id = (select grade_item_id from tasks where title = 'Lista de frações' and class_id = ${classId} limit 1)`;
  expect(gr[0].state).toBe("not_delivered");
  await s.page.goto("/portal/notas");
  await expect(s.page.getByText("Lista de frações")).toBeVisible();
  await expect(s.page.getByText(/Como foi calculada/)).toBeVisible();

  console.log('STEP prazo');
  // prazo vencido: atraso aceito (marcado) × recusado
  await t.goto(`/app/turmas/${classId}/tarefas`);
  for (const [title, late] of [["Trabalho com atraso", true], ["Trabalho sem atraso", false]] as const) {
    await t.getByLabel("Título").fill(title);
    if (!late) await t.getByLabel(/Aceitar entrega após o prazo/).uncheck();
    await t.getByRole("button", { name: "Criar rascunho" }).click();
    await t.waitForURL(/\/tarefas\/[0-9a-f-]{36}$/);
    await t.getByRole("button", { name: "Publicar para a turma" }).click();
    await expect(t.getByRole("button", { name: "Encerrar tarefa" })).toBeVisible();
    await sql`update tasks set due_at = now() - interval '1 day' where title = ${title}`;
    await t.goto(`/app/turmas/${classId}/tarefas`);
  }
  await s.page.goto("/portal/tarefas");
  await expect(s.page.getByText("Atrasada (não entregue)").first()).toBeVisible();
  await s.page.getByRole("link", { name: "Trabalho com atraso" }).click();
  await s.page.getByLabel("Resposta").fill("Aqui está.");
  await s.page.getByRole("button", { name: "Entregar" }).click();
  await expect(s.page.getByText(/Entregue em/)).toBeVisible();
  await expect(s.page.getByText("Entregue com atraso", { exact: true })).toBeVisible();
  await s.page.goto("/portal/tarefas");
  await s.page.getByRole("link", { name: "Trabalho sem atraso" }).click();
  await expect(s.page.getByText(/não aceita entregas atrasadas/)).toBeVisible();

  console.log('STEP pref');
  // preferência: responsável silencia "Tarefas" e a próxima publicação não gera aviso (importante e segurança seguem)
  await g.page.goto("/portal/notificacoes");
  await g.page.getByLabel("Tarefas").uncheck();
  await g.page.getByRole("button", { name: "Salvar preferências" }).click();
  await expect(g.page.getByText("Preferências salvas.")).toBeVisible();
  const before = (await sql`select count(*)::int n from notifications where user_id = ${gu.id} and category = 'tarefa'`)[0].n;
  await t.goto(`/app/turmas/${classId}/tarefas`);
  await t.getByLabel("Título").fill("Tarefa silenciada");
  await t.getByRole("button", { name: "Criar rascunho" }).click();
  await t.waitForURL(/\/tarefas\/[0-9a-f-]{36}$/);
  await t.getByRole("button", { name: "Publicar para a turma" }).click();
  await expect(t.getByRole("button", { name: "Encerrar tarefa" })).toBeVisible();
  expect((await sql`select count(*)::int n from notifications where user_id = ${gu.id} and category = 'tarefa'`)[0].n).toBe(before);
  expect((await sql`select count(*)::int n from notifications where user_id = ${su.id} and category = 'tarefa'`)[0].n).toBeGreaterThan(1); // aluno não silenciou

  /* ---------- Agenda e horários ---------- */
  console.log("STEP genda e horário");
  await t.goto("/app/agenda");
  const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const until = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  await t.getByLabel("Título").fill("Reunião de turma");
  await t.getByLabel("Para quem").selectOption("class");
  await t.getByLabel("Turma (se for de turma)").selectOption({ label: "7º C" });
  await t.getByLabel("Data").fill(today);
  await t.locator("#startTime").fill("23:00");
  await t.getByLabel("Repetir").selectOption("weekly");
  await t.getByLabel("Até").fill(until);
  await t.getByRole("button", { name: "Criar evento" }).click();
  await expect(t.getByText("Evento criado.")).toBeVisible();
  await t.getByLabel("Título").fill("Anotação pessoal");
  await t.getByLabel("Para quem").selectOption("personal");
  await t.getByLabel("Data").fill(today);
  await t.locator("#startTime").fill("07:00");
  await t.getByRole("button", { name: "Criar evento" }).click();
  await expect(t.getByText("Evento criado.").first()).toBeVisible();
  await sql`update tasks set due_at = ${today + "T15:00:00Z"} where title = ${"Tarefa silenciada"} and class_id = ${classId}`;
  await s.page.goto("/portal/agenda");
  await expect(s.page.getByText("Reunião de turma")).toBeVisible();
  await expect(s.page.getByText("Anotação pessoal")).toHaveCount(0);
  await expect(s.page.getByText("Prazo: Tarefa silenciada")).toBeVisible();
  await s.page.getByRole("link", { name: "Próxima →" }).click();
  await expect(s.page.getByText("Reunião de turma")).toBeVisible(); // recorrência semanal

  await t.goto("/app/horarios");
  await t.locator("#startTime").fill("08:00"); await t.locator("#endTime").fill("08:50");
  await t.getByLabel("Sala (opcional)").fill("Sala 3");
  await t.getByRole("button", { name: "Adicionar horário" }).click();
  await expect(t.getByText("Horário adicionado.")).toBeVisible();
  await t.locator("#startTime").fill("08:30"); await t.locator("#endTime").fill("09:20");
  await t.getByRole("button", { name: "Adicionar horário" }).click();
  await expect(t.getByText(/Conflito de horário/)).toBeVisible();
  await s.page.goto("/portal/agenda");
  await expect(s.page.getByText("08:00–08:50")).toBeVisible();
});
