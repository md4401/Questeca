import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { neon, neonConfig } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.test.local" });

const url = process.env.DATABASE_URL!;
if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${new URL(url).host}/sql`;
export const sql = neon(url);

export const uid = () => Math.random().toString(36).slice(2, 8);
export const PASSWORD = "Senha1234";

export async function signup(page: Page, opts: { name?: string; email?: string } = {}) {
  const email = opts.email ?? `prof-${uid()}@test.questeca.dev`;
  await page.goto("/criar-conta");
  await page.getByLabel("Nome", { exact: true }).fill(opts.name ?? "Professora Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByLabel(/Li e aceito/).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL(/\/(app|cadastro)/);
  return email;
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/app/);
}

export async function lastDevEmail(to: string, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const rows = await sql`select meta from events where name = 'dev_email' and meta->>'to' = ${to} order by created_at desc limit 1`;
    if (rows.length) return (rows[0].meta as { text: string; subject: string });
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`nenhum e-mail para ${to}`);
}

export const linkFrom = (text: string) => text.match(/https?:\/\/[^\s"<]+/)![0].replace("http://localhost:3100", "");

/** Cria turma + alunos direto na UI e devolve o id da turma. */
export async function createClass(page: Page, name = "9º B") {
  await page.goto("/app/turmas/nova");
  await page.getByLabel("Identificação da turma").fill(name);
  await page.getByRole("button", { name: "Criar turma" }).click();
  await page.waitForURL(/\/app\/turmas\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

export async function addStudents(page: Page, classId: string, lines: string) {
  await page.goto(`/app/turmas/${classId}/alunos`);
  await page.getByLabel("Lista de alunos").fill(lines);
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.getByRole("button", { name: "Adicionar selecionados" })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar selecionados" }).click();
  await expect(page.getByText(/aluno\(s\) adicionado\(s\)/)).toBeVisible();
}

export async function pdfText(request: APIRequestContext, urlPath: string) {
  const res = await request.get(urlPath);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  const buf = new Uint8Array(await res.body());
  expect(Buffer.from(buf).subarray(0, 4).toString()).toBe("%PDF");
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
