import { test, expect as baseExpect } from "@playwright/test";
import { signup, createClass, addStudents, sql, inviteLink, portalAccount } from "./helpers";

const expect = baseExpect.configure({ soft: true, timeout: 10000 });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAH0bC7wAAAABJRU5ErkJggg==", "base64");

test("Fase 2: mural, materiais, videoaulas e mensagens com regras da escola", async ({ browser }) => {
  test.setTimeout(290_000);
  const tctx = await browser.newContext(); const t = await tctx.newPage();
  const temail = await signup(t, { name: "Professor Fase2" });
  await sql`update subscriptions set plan = 'teacher' where org_id in (select m.org_id from memberships m join users u on u.id = m.user_id where u.email = ${temail})`;
  const classId = await createClass(t, "6º A");
  const classB = await createClass(t, "6º B");
  await addStudents(t, classId, "Duda Melo;1\nEdu Pires;2");
  await addStudents(t, classB, "Fabi Cruz;3");
  const g = await portalAccount(browser, await inviteLink(t, classId, "Duda Melo", "guardian"), "Mara Melo");
  const s = await portalAccount(browser, await inviteLink(t, classId, "Edu Pires", "student"), "Edu Pires");
  const gb = await portalAccount(browser, await inviteLink(t, classB, "Fabi Cruz", "guardian"), "Rui Cruz");

  /* ---------- Mural ---------- */
  console.log("STEP mural");
  await t.goto(`/app/turmas/${classId}/mural`);
  await t.getByLabel("Título (opcional)").fill("Passeio ao museu");
  await t.getByLabel("Texto").fill("Levem autorização assinada até sexta.");
  await t.getByRole("button", { name: "Publicar" }).click();
  await expect(t.getByText("Publicado para a turma.")).toBeVisible();
  await s.page.goto("/portal/mural");
  await expect(s.page.getByText("Passeio ao museu")).toBeVisible();
  await expect(s.page.getByText(/Visível para: alunos e responsáveis de 6º A/)).toBeVisible();
  await s.page.getByLabel("Comentário", { exact: true }).fill("Posso entregar na quinta?");
  await s.page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(s.page.getByText("Posso entregar na quinta?")).toBeVisible();
  await g.page.goto("/portal/mural");
  await expect(g.page.getByText("Passeio ao museu")).toBeVisible();
  await expect(g.page.getByText("Posso entregar na quinta?")).toBeVisible();
  await expect(g.page.getByLabel("Comentário", { exact: true })).toHaveCount(0); // responsável só lê
  await gb.page.goto("/portal/mural");
  await expect(gb.page.getByText("Passeio ao museu")).toHaveCount(0); // outra turma
  // denúncia → moderação → remoção
  await g.page.getByRole("button", { name: "Denunciar comentário" }).click();
  await t.goto("/app/moderacao");
  await expect(t.getByText("Posso entregar na quinta?")).toBeVisible();
  await t.getByRole("button", { name: "Remover conteúdo" }).click();
  await expect(t.getByText("Nenhuma denúncia aberta.")).toBeVisible();
  await s.page.goto("/portal/mural");
  await expect(s.page.getByText("Posso entregar na quinta?")).toHaveCount(0);

  /* ---------- Materiais ---------- */
  console.log("STEP materiais");
  await t.goto("/app/materiais");
  await t.getByLabel("Título").fill("Resumo de frações");
  await t.getByLabel("Compartilhar com").selectOption("class");
  await t.getByLabel("Turma (opcional)").selectOption({ label: "6º A" });
  await t.getByLabel("Etiquetas (separadas por vírgula)").fill("frações, resumo");
  await t.getByLabel("Texto").fill("Frações equivalentes têm o mesmo valor.");
  await t.getByLabel(/Ou arquivo/).setInputFiles({ name: "resumo.txt", mimeType: "text/plain", buffer: Buffer.from("conteudo do resumo") });
  await t.getByRole("button", { name: "Salvar" }).click();
  await expect(t.getByText("Material salvo.")).toBeVisible();
  await s.page.goto("/portal/materiais");
  await expect(s.page.getByText("Resumo de frações")).toBeVisible();
  const [mat] = await sql`select id from materials where title = 'Resumo de frações' order by created_at desc limit 1`;
  expect((await s.page.request.get(`/api/material/${mat.id}`)).status()).toBe(200);
  expect((await gb.page.request.get(`/api/material/${mat.id}`)).status()).toBe(404); // outra turma
  expect((await sql`select downloads from materials where id = ${mat.id}`)[0].downloads).toBe(1);
  await gb.page.goto("/portal/materiais");
  await expect(gb.page.getByText("Resumo de frações")).toHaveCount(0);

  /* ---------- Videoaulas ---------- */
  console.log("STEP videoaulas");
  await t.goto("/app/videoaulas");
  await t.getByLabel("Título").fill("Frações em 5 minutos");
  await t.getByLabel("Link do vídeo").fill("https://youtu.be/dQw4w9WgXcQ");
  await t.getByLabel(/Turma \(vazio/).selectOption({ label: "6º A" });
  await t.getByRole("button", { name: "Salvar" }).click();
  await expect(t.getByText(/salva como rascunho/)).toBeVisible();
  await s.page.goto("/portal/videoaulas");
  await expect(s.page.getByText("Frações em 5 minutos")).toHaveCount(0); // rascunho
  await t.getByRole("button", { name: "Publicar" }).click();
  await expect(t.getByRole("button", { name: "Despublicar" })).toBeVisible();
  await s.page.goto("/portal/videoaulas");
  await s.page.getByRole("link", { name: "Frações em 5 minutos" }).click();
  await expect(s.page.locator("iframe[src^='https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ']")).toBeVisible();
  await gb.page.goto("/portal/videoaulas");
  await expect(gb.page.getByText("Frações em 5 minutos")).toHaveCount(0);
  expect((await sql`select views from video_lessons where title = 'Frações em 5 minutos' order by created_at desc limit 1`)[0].views).toBe(1);

  /* ---------- Mensagens ---------- */
  console.log("STEP chat");
  const [su] = await sql`select id from users where email = ${s.email}`;
  const [gu] = await sql`select id from users where email = ${g.email}`;
  await s.page.goto("/portal/chat");
  await expect(s.page.getByText(/não habilitou mensagens para você/)).toBeVisible(); // aluno sem política
  await expect(s.page.getByLabel("Conversar com")).toHaveCount(0);
  await g.page.goto("/portal/chat");
  await g.page.getByLabel("Conversar com").selectOption({ label: "Professor Fase2 — Professor · 6º A" });
  await g.page.getByRole("button", { name: "Abrir conversa" }).click();
  await g.page.waitForURL(/\/portal\/chat\/[0-9a-f-]{36}$/);
  const convUrl = g.page.url(); const convId = convUrl.split("/").pop()!;
  await g.page.getByLabel("Mensagem", { exact: true }).fill("Olá, professor! A Duda tem consulta quinta.");
  await g.page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(g.page.getByText("Olá, professor! A Duda tem consulta quinta.")).toBeVisible();
  // professor recebe aviso, vê não lida, responde com imagem
  const [tu] = await sql`select id from users where email = ${temail}`;
  expect((await sql`select count(*)::int n from notifications where user_id = ${tu.id} and category = 'mensagem' and read_at is null`)[0].n).toBeGreaterThan(0);
  await t.goto("/app/chat");
  await expect(t.getByLabel(/não lidas/)).toBeVisible();
  await t.goto(`/app/chat/${convId}`);
  await expect(t.getByText("Olá, professor! A Duda tem consulta quinta.")).toBeVisible();
  await t.getByLabel("Mensagem", { exact: true }).fill("Combinado, obrigado!");
  await t.getByLabel(/Anexar arquivo/).setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await t.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(t.getByText("Combinado, obrigado!")).toBeVisible();
  // tipo perigoso é recusado
  await t.getByLabel("Mensagem", { exact: true }).fill("arquivo html");
  await t.getByLabel(/Anexar arquivo/).setInputFiles({ name: "x.html", mimeType: "text/html", buffer: Buffer.from("<script>alert(1)</script>") });
  await t.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(t.getByText(/Tipo de arquivo não permitido/)).toBeVisible();
  // responsável vê a resposta (atualização periódica) e a imagem
  await expect(g.page.getByText("Combinado, obrigado!")).toBeVisible({ timeout: 15000 });
  await expect(g.page.locator("img[alt='foto.png']")).toBeVisible();
  const [att] = await sql`select a.id from task_attachments a join messages m on m.id = a.message_id where m.conversation_id = ${convId} limit 1`;
  expect((await g.page.request.get(`/api/anexo/${att.id}`)).status()).toBe(200);
  expect((await s.page.request.get(`/api/anexo/${att.id}`)).status()).toBe(404); // aluno não é membro
  expect((await gb.page.request.get(`/api/chat/${convId}`)).status()).toBe(404);
  expect((await s.page.request.get(`/api/chat/${convId}`)).status()).toBe(404);
  // edição e exclusão da própria mensagem; fixar só equipe; reação
  await g.page.getByText("Ações", { exact: true }).first().click();
  await g.page.getByRole("button", { name: "Editar" }).first().click();
  await g.page.getByLabel("Editar mensagem").fill("Olá! A Duda tem consulta na quinta à tarde.");
  await g.page.getByRole("button", { name: "Salvar" }).click();
  await expect(g.page.getByText("Olá! A Duda tem consulta na quinta à tarde.")).toBeVisible();
  await expect(g.page.getByRole("button", { name: "Fixar" })).toHaveCount(0);
  await t.getByText("Ações", { exact: true }).first().click();
  await t.getByRole("button", { name: "Fixar" }).first().click();
  await expect(t.getByText("📌 Fixada")).toBeVisible();
  await t.getByRole("button", { name: "Reagir com 👍" }).first().click();
  await expect(t.getByRole("button", { name: /👍 1/ })).toBeVisible();
  // denúncia chega à moderação (coordenação/gestão); bloqueio institucional impede envio
  await g.page.getByText("Ações", { exact: true }).last().click();
  await g.page.getByRole("button", { name: "Denunciar" }).last().click();
  await baseExpect.poll(async () => (await sql`select count(*)::int n from content_reports where target_type = 'message' and reporter_id = ${gu.id}`)[0].n, { timeout: 10000 }).toBe(1);
  await sql`insert into chat_blocks (org_id, blocker_id, blocked_id, created_by) select org_id, null, ${gu.id}, ${tu.id} from conversations where id = ${convId}`;
  await g.page.getByLabel("Mensagem", { exact: true }).fill("Mais uma mensagem");
  await g.page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(g.page.getByText(/bloqueado pela escola/)).toBeVisible();
  await sql`delete from chat_blocks where blocked_id = ${gu.id}`;

  // política: habilitar aluno→professor e horário de atendimento
  await t.goto("/app/escola");
  await t.getByLabel("Alunos podem enviar mensagens aos professores").check();
  await t.getByRole("button", { name: "Salvar regras do portal" }).click();
  await expect(t.getByText("Regras do portal salvas.")).toBeVisible();
  await s.page.goto("/portal/chat");
  await s.page.getByLabel("Conversar com").selectOption({ label: "Professor Fase2 — Professor · 6º A" });
  await s.page.getByRole("button", { name: "Abrir conversa" }).click();
  await s.page.waitForURL(/\/portal\/chat\/[0-9a-f-]{36}$/);
  await s.page.getByLabel("Mensagem", { exact: true }).fill("Professor, tenho uma dúvida.");
  await s.page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(s.page.getByText("Professor, tenho uma dúvida.")).toBeVisible();
  // aluno e responsável não têm contato um com o outro
  await s.page.goto("/portal/chat");
  await expect(s.page.getByRole("option", { name: /Mara Melo/ })).toHaveCount(0);
  // horário fechado: portal não envia, equipe sim
  await t.goto("/app/escola");
  await t.getByLabel("Atendimento a partir de (HH:MM)").fill("03:00");
  await t.getByLabel("Atendimento até (HH:MM)").fill("03:01");
  await t.getByRole("button", { name: "Salvar regras do portal" }).click();
  await expect(t.getByText("Regras do portal salvas.")).toBeVisible();
  await g.page.goto(convUrl);
  await g.page.getByLabel("Mensagem", { exact: true }).fill("Fora do horário");
  await g.page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(g.page.getByText(/são recebidas entre 03:00 e 03:01/)).toBeVisible();
  await t.goto(`/app/chat/${convId}`);
  await t.getByLabel("Mensagem", { exact: true }).fill("Equipe fora do horário também envia");
  await t.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(t.getByText("Equipe fora do horário também envia")).toBeVisible();
  // busca nas minhas mensagens
  await t.goto("/app/chat?q=consulta");
  await expect(t.getByText(/Olá! A Duda tem consulta/)).toBeVisible();
  await s.page.goto("/portal/chat?q=consulta");
  await expect(s.page.getByText(/Nada encontrado/)).toBeVisible(); // aluno não vê conversa alheia
  void su;
});
