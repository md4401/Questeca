import { test, expect } from "@playwright/test";
import { signup, createClass, addStudents, sql } from "./helpers";

test("P2 aplicação digital por link individual + reprocesso após retificação de gabarito", async ({ page, browser }) => {
  test.setTimeout(420_000);
  await signup(page, { name: "Professora Digital" });
  const classId = await createClass(page, "9º E");
  await addStudents(page, classId, "Lia Prado;7001\nMax Nunes;7002");
  await page.goto(`/app/provas/nova?turma=${classId}`);
  await page.getByLabel("O que a turma estudou?").fill("Ensinei porcentagem simples.");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForURL(/\/escopo$/);
  const aid = page.url().split("/").slice(-2)[0];
  await page.getByLabel("Quantidade de questões").fill("3");
  await page.getByRole("button", { name: "Buscar questões" }).click();
  await page.waitForURL(new RegExp(`/app/provas/${aid}\\?`));
  await page.goto(`/app/provas/${aid}/aplicacao`);
  await page.getByRole("button", { name: /Confirmar aplicação/ }).click();
  await page.waitForURL(/\/correcao\?app=/);
  const appId = page.url().split("app=")[1];
  const keys = [...(await page.getByText(/Gabarito da versão aplicada:/).textContent())!.matchAll(/(\d)([A-E])/g)].map((m) => m[2]);
  expect(keys).toHaveLength(3);

  // gerar links individuais
  await page.getByRole("button", { name: "Gerar links" }).click();
  await expect(page.getByText(/2 link\(s\) criado\(s\)/)).toBeVisible({ timeout: 30_000 });
  const rows = await sql`select dl.token, s.name from digital_links dl join students s on s.id = dl.student_id where dl.application_id = ${appId} order by s.name`;
  expect(rows).toHaveLength(2);
  const lia = rows.find((r) => r.name === "Lia Prado")!.token as string;

  // aluno sem conta abre o link: vê só o primeiro nome e as questões, sem gabarito
  const stu = await browser.newContext();
  const sp = await stu.newPage();
  await sp.goto(`/r/${lia}`);
  await expect(sp.getByText(/Aluno\(a\): Lia\./)).toBeVisible();
  await expect(sp.getByText("Max Nunes")).toHaveCount(0);
  await expect(sp.getByText(/Gabarito|Resposta:/)).toHaveCount(0);
  await expect(sp.locator("fieldset")).toHaveCount(3);
  for (let i = 0; i < 3; i++) await sp.locator(`input[name=q${i + 1}][value=${keys[i]}]`).check();
  await sp.getByRole("button", { name: "Enviar respostas" }).click();
  await expect(sp.getByText(/Respostas enviadas/)).toBeVisible();
  // segundo uso do mesmo link é recusado
  await sp.goto(`/r/${lia}`);
  await expect(sp.getByText("Respostas já enviadas")).toBeVisible();
  // link inválido e vencido
  await sp.goto("/r/token-inexistente-0123456789");
  await expect(sp.getByText("Link inválido")).toBeVisible();
  const max = rows.find((r) => r.name === "Max Nunes")!.token as string;
  await sql`update digital_links set expires_at = now() - interval '1 hour' where token = ${max}`;
  await sp.goto(`/r/${max}`);
  await expect(sp.getByText("Prazo encerrado")).toBeVisible();
  await stu.close();

  // respostas chegam corrigidas na grade do professor
  await page.reload();
  await expect(page.locator("tr", { hasText: "Lia Prado" }).first().locator("td").last()).not.toHaveText("0");
  const total = await sql`select coalesce(sum(points),0)::float as p from responses where application_id = ${appId}`;
  expect(Number(total[0].p)).toBeGreaterThan(0);

  // retificação de gabarito: banner de revisão e reprocesso; notas da turma não mudam sozinhas
  const q1 = await sql`select q.id, q.answer from assessment_items ai join questions q on q.id = ai.question_id where ai.assessment_id = ${aid} and ai.position = 1`;
  const qid = q1[0].id as string; const original = q1[0].answer as string;
  const flipped = original === "A" ? "B" : "A";
  try {
    await sql`update questions set answer = ${flipped}, version = version + 1 where id = ${qid}`;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Gabarito corrigido pela curadoria" })).toBeVisible();
    await expect(page.getByText(/não foram alteradas/)).toBeVisible();
    await page.getByRole("button", { name: "Aplicar gabarito corrigido e recalcular respostas" }).click();
    await expect(page.getByRole("heading", { name: "Gabarito corrigido pela curadoria" })).toHaveCount(0);
    const vers = await sql`select count(*)::int as n from assessment_versions where assessment_id = ${aid}`;
    expect(Number(vers[0].n)).toBeGreaterThanOrEqual(2); // versão anterior preservada
    const after = await sql`select points::float as p from responses where application_id = ${appId} and position = 1 and student_id = (select id from students where name = 'Lia Prado' and org_id = (select org_id from classes where id = ${classId}))`;
    expect(Number(after[0].p)).toBe(0); // ela marcou a resposta antiga
  } finally {
    await sql`update questions set answer = ${original} where id = ${qid}`;
  }
});
