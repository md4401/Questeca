import { test, expect as baseExpect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { signup, createClass, pdfText, sql } from "./helpers";
const expect = baseExpect.configure({ soft: true, timeout: 10000 });

const audit = async (page: Page, name: string) => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(`A11Y ${name}:`, bad.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target?.join(" ")}`).join(" | "));
  expect(bad, `${name}: ${bad.map((v) => v.id).join(", ")}`).toEqual([]);
};
const TEXT = "Matemática, 9º B. Ensinei porcentagem simples e descontos sucessivos. Ainda não trabalhei juros compostos.";
const setHtml = async (page: Page, label: string, html: string) => {
  await page.getByRole("textbox", { name: label, exact: true }).evaluate((el, h) => { (el as HTMLElement).innerHTML = h; el.dispatchEvent(new Event("input", { bubbles: true })); }, html);
};

test("Editor da prova: editar texto como no Word, blocos, restaurar, salvar e sair nos arquivos", async ({ page: t, request }) => {
  test.setTimeout(150_000);
  const email = await signup(t, { name: "Professora Editor" });
  await sql`update subscriptions set plan = 'teacher' where org_id in (select m.org_id from memberships m join users u on u.id = m.user_id where u.email = ${email})`;
  const classId = await createClass(t);
  await t.goto(`/app/provas/nova?turma=${classId}`);
  await t.getByLabel("Título da prova").fill("Prova de porcentagem");
  await t.getByLabel("O que a turma estudou?").fill(TEXT);
  await t.getByRole("button", { name: "Continuar" }).click();
  await t.waitForURL(/\/escopo$/);
  const id = t.url().split("/").slice(-2)[0];
  await t.getByLabel("Quantidade de questões").fill("4");
  await t.getByRole("button", { name: "Buscar questões" }).click();
  await t.waitForURL(new RegExp(`/app/provas/${id}\\?`));

  // aba "Editar texto"
  await t.getByRole("link", { name: "Editar texto" }).click();
  await t.waitForURL(/\/editar$/);
  await expect(t.getByRole("heading", { name: "Editar texto da prova" })).toBeVisible();
  await expect(t.getByRole("toolbar", { name: "Formatação do texto" })).toBeVisible();
  await expect(t.getByRole("textbox", { name: "Enunciado da questão 1" })).toBeVisible();
  const original = (await t.getByRole("textbox", { name: "Enunciado da questão 1", exact: true }).innerText()).trim();
  await audit(t, "editor");

  // editar enunciado com formatação, uma alternativa, título e instruções
  await setHtml(t, "Enunciado da questão 1", "Um texto <b>novo em negrito</b>, <i>itálico</i> e <u>sublinhado</u> do enunciado.");
  await setHtml(t, "Alternativa A da questão 1", "Alternativa <b>alterada</b> A");
  await t.locator("#exam-title").fill("Prova de Porcentagem — 1º bimestre");
  await setHtml(t, "Instruções da prova", "Use caneta <b>azul ou preta</b>. Sem consulta.");
  await t.getByRole("button", { name: "Inserir texto antes da questão 2" }).click();
  await t.getByRole("textbox", { name: "Bloco de texto" }).first().fill("Leia o texto de apoio antes de responder.");
  await t.getByRole("button", { name: "Salvar" }).click();
  await expect(t.getByRole("status").filter({ hasText: /Salvo às/ })).toBeVisible();

  // gravou como override, o banco de questões não mudou
  const [ov] = await sql`select override from assessment_items where assessment_id = ${id} order by position limit 1`;
  expect(JSON.stringify(ov.override)).toContain("{b}novo em negrito{/b}");
  const [lay] = await sql`select layout, title from assessments where id = ${id}`;
  expect(lay.title).toBe("Prova de Porcentagem — 1º bimestre"); expect(JSON.stringify(lay.layout)).toContain("Leia o texto de apoio");
  expect((await sql`select count(*)::int n from questions where statement like '%novo em negrito%'`)[0].n).toBe(0);

  // recarregar mantém
  await t.reload();
  await expect(t.getByRole("textbox", { name: "Enunciado da questão 1", exact: true })).toContainText("Um texto novo em negrito, itálico e sublinhado do enunciado.");
  await expect(t.locator('[data-field^="st:"] b').first()).toHaveText("novo em negrito");

  // PDF do aluno traz o texto editado, o bloco, as instruções e o título
  const pdf = await pdfText(request, `/api/export/prova?id=${id}&rascunho=1&tipo=aluno`);
  expect(pdf).toContain("Um texto novo em negrito, itálico e sublinhado do enunciado.");
  expect(pdf).toContain("Alternativa alterada A"); expect(pdf).toContain("Leia o texto de apoio antes de responder.");
  expect(pdf).toContain("Use caneta azul ou preta"); expect(pdf).toContain("Prova de Porcentagem — 1º bimestre");
  expect(pdf).not.toContain("Gabarito");
  // Word com negrito, itálico e sublinhado de verdade
  const docx = await request.get(`/api/export/prova?id=${id}&rascunho=1&tipo=aluno&formato=docx`);
  expect(docx.status()).toBe(200);
  const dir = mkdtempSync(join(tmpdir(), "docx-")); const f = join(dir, "p.docx"); writeFileSync(f, await docx.body());
  const xml = execFileSync("unzip", ["-p", f, "word/document.xml"]).toString();
  expect(xml).toContain("novo em negrito"); expect(xml).toMatch(/<w:b\/>[\s\S]*novo em negrito/); expect(xml).toContain("<w:i/>"); expect(xml).toContain("<w:u ");

  // restaurar original
  await t.getByRole("button", { name: "Restaurar o texto original da questão 1" }).click();
  await expect(t.getByRole("textbox", { name: "Enunciado da questão 1", exact: true })).toHaveText(original);
  await t.getByRole("button", { name: "Salvar" }).click();
  await expect(t.getByRole("status").filter({ hasText: /Salvo às/ })).toBeVisible();
  const [ov2] = await sql`select override from assessment_items where assessment_id = ${id} order by position limit 1`;
  expect(ov2.override).toBeNull();
  const pdf2 = await pdfText(request, `/api/export/prova?id=${id}&rascunho=1&tipo=aluno`);
  expect(pdf2).not.toContain("novo em negrito"); expect(pdf2).toContain(original.slice(0, 25));

  // enunciado vazio é recusado
  await setHtml(t, "Enunciado da questão 1", "");
  await t.getByRole("button", { name: "Salvar" }).click();
  await expect(t.getByRole("status").filter({ hasText: /não pode ficar vazio/ })).toBeVisible();
  // outro usuário não edita
  const other = await t.context().browser()!.newContext(); const o = await other.newPage(); await signup(o, { name: "Intruso" });
  expect((await o.goto(`/app/provas/${id}/editar`))?.status()).toBe(404);
  await other.close();
});
