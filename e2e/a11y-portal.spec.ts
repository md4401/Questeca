import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signup, createClass, addStudents, sql, inviteLink, portalAccount } from "./helpers";

async function audit(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(`A11Y ${name}:`, bad.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target?.join(" ")}`).join(" | "));
  return bad.map((v) => `${name}: ${v.id}`);
}

test("acessibilidade (axe WCAG 2.2 AA) nas telas de equipe e do portal, no claro e no escuro", async ({ browser }) => {
  test.setTimeout(290_000);
  const ctx = await browser.newContext(); const t = await ctx.newPage();
  const temail = await signup(t, { name: "Prof A11y" });
  await sql`update subscriptions set plan = 'teacher' where org_id in (select m.org_id from memberships m join users u on u.id = m.user_id where u.email = ${temail})`;
  const classId = await createClass(t, "7º A");
  await addStudents(t, classId, "Ana Teste;1\nBia Teste;2");
  const g = await portalAccount(browser, await inviteLink(t, classId, "Ana Teste", "guardian"), "Rita Teste");
  const s = await portalAccount(browser, await inviteLink(t, classId, "Bia Teste", "student"), "Bia Teste");
  const [tu] = await sql`select id from users where email = ${temail}`;
  await sql`insert into tasks (org_id, class_id, owner_id, title, status, questions) select org_id, id, ${tu.id}, 'Tarefa A11y', 'published', '[]'::jsonb from classes where id = ${classId}`;
  const bad: string[] = [];
  const staff = ["/app", "/app/agenda", "/app/horarios", "/app/chat", "/app/materiais", "/app/videoaulas", "/app/moderacao", "/app/notificacoes", "/app/conta", "/cadastro?editar=1",
    `/app/turmas/${classId}/frequencia`, `/app/turmas/${classId}/tarefas`, `/app/turmas/${classId}/mural`, `/app/turmas/${classId}/quizzes`, `/app/turmas/${classId}/boletins`, `/app/turmas/${classId}/analitico`, `/app/turmas/${classId}/engajamento`, `/app/turmas/${classId}/acessos`];
  for (const p of staff) { await t.goto(p); bad.push(...await audit(t, p)); }
  for (const p of ["/portal", "/portal/tarefas", "/portal/agenda", "/portal/notas", "/portal/frequencia", "/portal/mural", "/portal/chat", "/portal/videoaulas", "/portal/materiais", "/portal/quizzes", "/portal/conquistas", "/portal/boletim", "/portal/desempenho", "/portal/notificacoes", "/portal/conta"]) {
    await s.page.goto(p); bad.push(...await audit(s.page, p));
  }
  await g.page.goto("/portal"); bad.push(...await audit(g.page, "guardian /portal"));
  // tema escuro (contraste)
  await s.page.evaluate(() => { localStorage.setItem("qs_theme", "dark"); document.documentElement.dataset.theme = "dark"; });
  for (const p of ["/portal", "/portal/conquistas", "/portal/tarefas", "/portal/conta"]) { await s.page.goto(p); bad.push(...await audit(s.page, `[escuro] ${p}`)); }
  await t.evaluate(() => { localStorage.setItem("qs_theme", "dark"); });
  for (const p of ["/app", `/app/turmas/${classId}/analitico`, "/app/chat"]) { await t.goto(p); bad.push(...await audit(t, `[escuro] ${p}`)); }
  expect(bad, bad.join("\n")).toEqual([]);
});
