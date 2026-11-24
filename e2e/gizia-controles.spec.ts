import { test, expect as baseExpect } from "@playwright/test";
import { signup, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 15000 });
// Precisa do servidor falso de IA: node e2e/mock-llm.mjs, e o app com AI_PROVIDER=nvidia NVIDIA_API_KEY=x NVIDIA_URL=http://127.0.0.1:9999/v1
test.skip(!process.env.E2E_AI_MOCK, "defina E2E_AI_MOCK=1 com o servidor falso de IA");

test("GizIA: parar a resposta, editar mensagem e enviar arquivo", async ({ page: t }) => {
  test.setTimeout(150_000);
  const email = await signup(t);
  await sql`update users set onboarding_done_at = now() where email = ${email}`;
  await t.goto("/app/assistente");
  const campo = t.getByLabel("Mensagem para a GizIA");
  const enviar = async (txt: string) => { await campo.fill(txt); await campo.press("Enter"); };
  const sessao = async () => (await sql`select s.id from assistant_sessions s join users u on u.id = s.user_id where u.email = ${email} order by s.updated_at desc limit 1`)[0]?.id as string;

  /* ---- Parar ---- */
  await enviar("[lento] pergunta que demora");
  const parar = t.getByTestId("parar");
  await expect(parar).toBeVisible();
  await parar.click();
  await expect(t.getByTestId("msg-nota")).toContainText("Resposta interrompida.");
  await expect(t.getByRole("button", { name: "Enviar", exact: true })).toBeVisible();   // voltou o botão Enviar
  await expect(t.getByTestId("parar")).toHaveCount(0);
  await t.waitForTimeout(6500); // a resposta falsa levaria 5 s: não pode ter sido gravada
  const id1 = await sessao();
  expect((await sql`select count(*)::int n from assistant_messages where session_id = ${id1} and role = 'assistant'`)[0].n).toBe(0);
  expect((await sql`select count(*)::int n from assistant_messages where session_id = ${id1} and role = 'user'`)[0].n).toBe(1);

  /* ---- Editar mensagem ---- */
  await t.getByTestId("nova-conversa").click();
  await enviar("primeira pergunta");
  await expect(t.getByTestId("msg-assistente")).toHaveCount(1);
  await enviar("segunda pergunta");
  await expect(t.getByTestId("msg-assistente")).toHaveCount(2);
  await t.getByTestId("msg-usuario").first().hover();
  await t.getByRole("button", { name: "Editar mensagem" }).first().click();
  await t.getByRole("textbox", { name: "Editar mensagem" }).fill("primeira pergunta EDITADA");
  await t.getByRole("button", { name: "Cancelar" }).click(); // cancelar não muda nada
  await expect(t.getByTestId("msg-usuario")).toHaveCount(2);
  await t.getByTestId("msg-usuario").first().hover();
  await t.getByRole("button", { name: "Editar mensagem" }).first().click();
  await t.getByRole("textbox", { name: "Editar mensagem" }).fill("primeira pergunta EDITADA");
  await t.getByRole("textbox", { name: "Editar mensagem" }).locator("xpath=ancestor::form").getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(t.getByTestId("msg-usuario")).toHaveCount(1);        // a "segunda pergunta" foi descartada
  await expect(t.getByTestId("msg-usuario").first()).toContainText("EDITADA");
  await expect(t.getByTestId("msg-assistente")).toHaveCount(1);
  const id2 = await sessao();
  const msgs = await sql`select role, content from assistant_messages where session_id = ${id2} order by created_at, id`;
  expect(msgs.map((m) => m.content).join("|")).not.toContain("segunda pergunta");
  expect(msgs.filter((m) => m.role === "user").map((m) => m.content)).toEqual(["primeira pergunta EDITADA"]);
  expect((await sql`select title from assistant_sessions where id = ${id2}`)[0].title).toBe("primeira pergunta EDITADA"); // editar a 1ª mensagem recomeça a conversa: o título acompanha o texto novo
  await t.reload();
  await expect(t.getByTestId("msg-usuario")).toHaveCount(1);

  /* ---- Enviar arquivo ---- */
  await t.getByTestId("nova-conversa").click();
  await t.getByRole("button", { name: "Anexar arquivo ou atalhos" }).click();
  const [seletor] = await Promise.all([t.waitForEvent("filechooser"), t.getByTestId("anexar-arquivo").click()]); // o item do menu abre o seletor de arquivos
  await seletor.setFiles({ name: "roteiro.txt", mimeType: "text/plain", buffer: Buffer.from("Roteiro: a fotossíntese ocorre nos cloroplastos das folhas.") });
  await expect(t.getByText("roteiro.txt")).toBeVisible();
  await t.getByRole("button", { name: "Remover o arquivo roteiro.txt" }).click();
  await expect(t.getByText("roteiro.txt")).toHaveCount(0);
  await t.getByTestId("input-arquivo").setInputFiles({ name: "roteiro.txt", mimeType: "text/plain", buffer: Buffer.from("Roteiro: a fotossíntese ocorre nos cloroplastos das folhas.") });
  await campo.fill("resuma o arquivo");
  await campo.press("Enter");
  await expect(t.getByTestId("msg-usuario").first()).toContainText("roteiro.txt");
  await expect(t.getByTestId("msg-assistente").first()).toContainText("Li o anexo: Roteiro: a fotossíntese ocorre nos cloroplastos");
  const id3 = await sessao();
  const [m] = await sql`select attachments from assistant_messages where session_id = ${id3} and role = 'user'`;
  expect(m.attachments[0].name).toBe("roteiro.txt");
  expect(m.attachments[0].text).toContain("cloroplastos");
  // ao reabrir, só aparecem nome e tamanho (o texto extraído não volta para a tela)
  const api = await (await t.request.get(`/api/assistente/sessoes/${id3}`)).json();
  const anexoApi = api.mensagens.find((x: { role: string }) => x.role === "user").attachments[0];
  expect(Object.keys(anexoApi).sort()).toEqual(["mime", "name", "size"]); // sem o campo "text"
  expect(anexoApi.name).toBe("roteiro.txt");
  await t.reload();
  await expect(t.getByTestId("msg-usuario").first()).toContainText("roteiro.txt");
  // editar a mensagem mantém o anexo
  await t.getByTestId("msg-usuario").first().hover();
  await t.getByRole("button", { name: "Editar mensagem" }).first().click();
  await t.getByRole("textbox", { name: "Editar mensagem" }).fill("resuma em uma frase");
  await t.getByRole("textbox", { name: "Editar mensagem" }).locator("xpath=ancestor::form").getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(t.getByTestId("msg-assistente").first()).toContainText("Li o anexo:");
  expect((await sql`select attachments from assistant_messages where session_id = ${id3} and role = 'user'`)[0].attachments[0].name).toBe("roteiro.txt");

  /* ---- Validações do anexo ---- */
  await t.getByTestId("nova-conversa").click();
  await t.getByTestId("input-arquivo").setInputFiles({ name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
  await expect(t.locator(".giz-arq-erro")).toContainText("use PDF, DOCX, TXT ou foto");
  const quatro = ["a", "b", "c", "d"].map((n) => ({ name: `${n}.txt`, mimeType: "text/plain", buffer: Buffer.from(`texto ${n}`) }));
  await t.getByTestId("input-arquivo").setInputFiles(quatro);
  await expect(t.locator(".giz-arq-erro")).toContainText("No máximo 3 arquivos");
});
