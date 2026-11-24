import { test, expect as baseExpect } from "@playwright/test";
import { signup, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 12000 });

test("GizIA: página, aviso sem chave, API protegida e download de apresentação só do dono", async ({ page: t, browser }) => {
  test.setTimeout(90_000);
  const email = await signup(t);
  await t.goto("/app/assistente");
  await expect(t.getByRole("heading", { name: "GizIA" })).toBeVisible();
  await expect(t.getByRole("link", { name: "GizIA" })).toBeVisible();
  const ativo = await t.getByLabel("Mensagem para a GizIA").count();
  if (!ativo) await expect(t.getByText("A GizIA ainda não está ativada")).toBeVisible();

  // API: sem chave responde 503; com mensagem inválida 400/503; nunca 200 sem IA
  const r = await t.request.post("/api/assistente", { data: { message: "oi" } });
  expect([200, 503, 502]).toContain(r.status());
  const anon = await (await browser.newContext()).request.post("/api/assistente", { data: { message: "oi" } });
  expect(anon.status()).toBe(401);

  // apresentação criada pelo assistente: baixa como .pptx, e outro usuário não consegue
  {
    const [u] = await sql`select u.id, m.org_id from users u join memberships m on m.user_id = u.id where u.email = ${email} limit 1`;
    if (u) {
      const [f] = await sql`insert into assistant_files (org_id, owner_id, kind, title, data) values (${u.org_id}, ${u.id}, 'pptx', 'Revolução Francesa', ${JSON.stringify({ slides: [{ titulo: "Causas", topicos: ["Crise financeira", "Iluminismo"], notas: "Falar devagar" }] })}::jsonb) returning id`;
      const d = await t.request.get(`/api/assistente/arquivo/${f.id}`);
      expect(d.status()).toBe(200);
      expect(d.headers()["content-type"]).toContain("presentationml");
      const body = await d.body();
      expect(body.subarray(0, 2).toString()).toBe("PK");
      const outro = await browser.newContext(); const p2 = await outro.newPage();
      await signup(p2);
      expect((await p2.request.get(`/api/assistente/arquivo/${f.id}`)).status()).toBe(404);
    }
  }
});

test("GizIA: créditos (1.000 tokens = 1 crédito) bloqueiam ao estourar o limite diário", async ({ page: t }) => {
  test.setTimeout(60_000);
  const email = await signup(t);
  await t.goto("/app/assistente");
  const [u] = await sql`select u.id, m.org_id from users u join memberships m on m.user_id = u.id where u.email = ${email} limit 1`;
  // 99.500 tokens = 99,5 créditos usados → ainda resta meio crédito
  await sql`insert into ai_usage (user_id, org_id, kind, prompt_tokens, completion_tokens, tokens) values (${u.id}, ${u.org_id}, 'llm', 90000, 9500, 99500)`;
  await t.goto("/app/assistente");
  await expect(t.getByText(/99,5 usados de 100/).or(t.getByText("A GizIA ainda não está ativada"))).toBeVisible();
  const ok = await t.request.post("/api/assistente", { data: { message: "oi" } });
  expect(ok.status()).not.toBe(402);
  await sql`insert into ai_usage (user_id, org_id, kind, prompt_tokens, completion_tokens, tokens) values (${u.id}, ${u.org_id}, 'llm', 800, 200, 1000)`;
  const bloq = await t.request.post("/api/assistente", { data: { message: "oi" } });
  expect(bloq.status()).toBe(402);
  expect((await bloq.json()).erro).toContain("créditos de IA de hoje acabaram");
  expect((await bloq.json()).creditos.restantes).toBe(0);
});

test("GizIA: sessões de conversa (criar, listar, renomear, abrir, apagar) e isolamento entre professores", async ({ page: t, browser }) => {
  test.setTimeout(60_000);
  const email = await signup(t);
  const [u] = await sql`select id from users where email = ${email}`;
  // cria
  const c = await t.request.post("/api/assistente/sessoes");
  expect(c.status()).toBe(201);
  const { id } = await c.json();
  await sql`insert into assistant_messages (session_id, role, content) values (${id}, 'user', 'Monte uma prova')`;
  await sql`insert into assistant_messages (session_id, role, content) values (${id}, 'assistant', 'Pronto, criei a prova.')`;
  // lista e abre
  const lista = await (await t.request.get("/api/assistente/sessoes")).json();
  expect(lista.sessoes.map((x: { id: string }) => x.id)).toContain(id);
  const aberta = await (await t.request.get(`/api/assistente/sessoes/${id}`)).json();
  expect(aberta.mensagens.map((m: { content: string }) => m.content)).toEqual(["Monte uma prova", "Pronto, criei a prova."]);
  // renomeia (validação: vazio → 400)
  expect((await t.request.patch(`/api/assistente/sessoes/${id}`, { data: { titulo: "Prova de Machado" } })).status()).toBe(200);
  expect((await t.request.patch(`/api/assistente/sessoes/${id}`, { data: { titulo: "   " } })).status()).toBe(400);
  expect((await (await t.request.get(`/api/assistente/sessoes/${id}`)).json()).title).toBe("Prova de Machado");
  // outro professor não enxerga, não renomeia, não apaga, e não envia mensagem na conversa alheia
  const outro = await browser.newContext(); const p2 = await outro.newPage();
  await signup(p2);
  expect((await p2.request.get(`/api/assistente/sessoes/${id}`)).status()).toBe(404);
  expect((await p2.request.patch(`/api/assistente/sessoes/${id}`, { data: { titulo: "x" } })).status()).toBe(404);
  expect((await p2.request.delete(`/api/assistente/sessoes/${id}`)).status()).toBe(404);
  expect((await (await p2.request.get("/api/assistente/sessoes")).json()).sessoes).toEqual([]);
  expect([404, 503]).toContain((await p2.request.post("/api/assistente", { data: { message: "oi", sessionId: id } })).status());
  // anônimo
  expect((await (await browser.newContext()).request.get(`/api/assistente/sessoes/${id}`)).status()).toBe(401);
  // apaga (mensagens vão junto)
  expect((await t.request.delete(`/api/assistente/sessoes/${id}`)).status()).toBe(200);
  expect((await t.request.get(`/api/assistente/sessoes/${id}`)).status()).toBe(404);
  expect((await sql`select count(*)::int n from assistant_messages where session_id = ${id}`)[0].n).toBe(0);
  void u;
});
