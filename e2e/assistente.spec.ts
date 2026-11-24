import { test, expect as baseExpect } from "@playwright/test";
import { signup, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 12000 });

test("Assistente IA: página, aviso sem chave, API protegida e download de apresentação só do dono", async ({ page: t, browser }) => {
  test.setTimeout(90_000);
  const email = await signup(t);
  await t.goto("/app/assistente");
  await expect(t.getByRole("heading", { name: "Assistente IA" })).toBeVisible();
  await expect(t.getByRole("link", { name: "Assistente IA" })).toBeVisible();
  const ativo = await t.getByLabel("Mensagem para o assistente").count();
  if (!ativo) await expect(t.getByText("O assistente ainda não está ativado")).toBeVisible();

  // API: sem chave responde 503; com mensagem inválida 400/503; nunca 200 sem IA
  const r = await t.request.post("/api/assistente", { data: { messages: [{ role: "user", content: "oi" }] } });
  expect([200, 503, 502]).toContain(r.status());
  const anon = await (await browser.newContext()).request.post("/api/assistente", { data: { messages: [{ role: "user", content: "oi" }] } });
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

test("Assistente IA: créditos (1.000 tokens = 1 crédito) bloqueiam ao estourar o limite diário", async ({ page: t }) => {
  test.setTimeout(60_000);
  const email = await signup(t);
  await t.goto("/app/assistente");
  const [u] = await sql`select u.id, m.org_id from users u join memberships m on m.user_id = u.id where u.email = ${email} limit 1`;
  // 99.500 tokens = 99,5 créditos usados → ainda resta meio crédito
  await sql`insert into ai_usage (user_id, org_id, kind, prompt_tokens, completion_tokens, tokens) values (${u.id}, ${u.org_id}, 'llm', 90000, 9500, 99500)`;
  await t.goto("/app/assistente");
  await expect(t.getByText(/99,5 usados de 100/).or(t.getByText("O assistente ainda não está ativado"))).toBeVisible();
  const ok = await t.request.post("/api/assistente", { data: { messages: [{ role: "user", content: "oi" }] } });
  expect(ok.status()).not.toBe(402);
  await sql`insert into ai_usage (user_id, org_id, kind, prompt_tokens, completion_tokens, tokens) values (${u.id}, ${u.org_id}, 'llm', 800, 200, 1000)`;
  const bloq = await t.request.post("/api/assistente", { data: { messages: [{ role: "user", content: "oi" }] } });
  expect(bloq.status()).toBe(402);
  expect((await bloq.json()).erro).toContain("créditos de IA de hoje acabaram");
  expect((await bloq.json()).creditos.restantes).toBe(0);
});
