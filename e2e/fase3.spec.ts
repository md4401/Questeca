import { test, expect as baseExpect, type Page } from "@playwright/test";
import { signup, createClass, addStudents, sql, inviteLink, portalAccount } from "./helpers";

const expect = baseExpect.configure({ soft: true, timeout: 10000 });

async function newQuiz(t: Page, classId: string, title: string, opts: { limit?: number; attempts?: number; explanations?: string; items: "full" | "simple" }) {
  await t.goto(`/app/turmas/${classId}/quizzes`);
  await t.getByLabel("Título").fill(title);
  if (opts.limit) await t.getByLabel(/Tempo limite/).fill(String(opts.limit));
  await t.getByLabel("Tentativas").fill(String(opts.attempts ?? 1));
  if (opts.explanations) await t.getByLabel("Explicações aos alunos").selectOption(opts.explanations);
  await t.getByRole("button", { name: "+ Múltipla escolha" }).click();
  await t.getByLabel("Enunciado").nth(0).fill("Quanto é 2 + 2?");
  await t.getByLabel("Texto da alternativa A da questão 1").fill("3");
  await t.getByLabel("Texto da alternativa B da questão 1").fill("4");
  await t.getByLabel("Alternativa B correta").check();
  await t.getByLabel("Explicação (mostrada conforme a política)").nth(0).fill("Somando dois com dois, temos quatro.");
  await t.getByLabel("Pontos").nth(0).fill("2");
  if (opts.items === "full") {
    await t.getByRole("button", { name: "+ Verdadeiro ou falso" }).click();
    await t.getByLabel("Enunciado").nth(1).fill("0,5 é igual a 1/2.");
    await t.getByRole("button", { name: "+ Desafio" }).click();
    await t.getByLabel("Enunciado").nth(2).fill("Qual é a capital do Brasil?");
    await t.getByLabel(/Respostas aceitas/).fill("Brasília\nBrasilia");
    await t.getByLabel("Pontos").nth(2).fill("2");
    await t.getByRole("button", { name: "+ Discursiva" }).click();
    await t.getByLabel("Enunciado").nth(3).fill("Explique o que é fração.");
    await t.getByLabel("Pontos").nth(3).fill("5");
  }
  await t.getByRole("button", { name: "Criar rascunho" }).click();
  await t.waitForURL(/\/quizzes\/[0-9a-f-]{36}$/);
  const url = t.url();
  await t.getByRole("button", { name: "Publicar para a turma" }).click();
  await expect(t.getByText("Quiz publicado.")).toBeVisible();
  return url;
}

test("Fase 3: quizzes (tempo, tentativas, prazo, correção) e gamificação idempotente", async ({ browser }) => {
  test.setTimeout(290_000);
  const tctx = await browser.newContext(); const t = await tctx.newPage();
  await signup(t, { name: "Professor Fase3" });
  const classId = await createClass(t, "8º D");
  await addStudents(t, classId, "Gabi Nunes;1\nHugo Alves;2");
  const g = await portalAccount(browser, await inviteLink(t, classId, "Gabi Nunes", "guardian"), "Lia Nunes");
  const s = await portalAccount(browser, await inviteLink(t, classId, "Hugo Alves", "student"), "Hugo Alves");
  const [hugo] = await sql`select student_id from student_accounts sa join users u on u.id = sa.user_id where u.email = ${s.email}`;
  const xpSum = async () => Number((await sql`select coalesce(sum(points),0)::int n from xp_events where student_id = ${hugo.student_id}`)[0].n);

  /* ---------- IA e engajamento ---------- */
  console.log("STEP quiz");
  await t.goto(`/app/turmas/${classId}/quizzes`);
  await expect(t.getByLabel(/Sugerir questões por IA/)).toBeDisabled();
  await expect(t.getByText(/IA não configurada/)).toBeVisible();

  const quizUrl = await newQuiz(t, classId, "Quiz de revisão", { attempts: 2, explanations: "after_due", items: "full" });
  const quizId = quizUrl.split("/").pop()!;
  await sql`update quizzes set due_at = now() + interval '2 days' where id = ${quizId}`;

  // acesso ao portal: XP uma única vez por dia, mesmo com vários acessos
  await s.page.goto("/portal"); await s.page.goto("/portal"); await s.page.goto("/portal/quizzes");
  expect((await sql`select count(*)::int n from xp_events where student_id = ${hugo.student_id} and kind = 'access'`)[0].n).toBe(1);

  await s.page.getByRole("link", { name: "Quiz de revisão" }).click();
  await s.page.getByRole("button", { name: "Começar quiz" }).click();
  await expect(s.page.getByRole("button", { name: "Enviar respostas" })).toBeVisible();
  await s.page.getByLabel("B) 4").check();
  await s.page.getByLabel("Falso").check();
  await s.page.getByLabel("Resposta da questão 3").fill("  BRASILIA ");
  await s.page.getByLabel("Resposta da questão 4").fill("Parte de um todo dividido em partes iguais.");
  await s.page.getByRole("button", { name: "Enviar respostas" }).click();
  await expect(s.page.getByRole("heading", { name: /Tentativa 1 — 4 de 10 \(40%\)/ })).toBeVisible();
  await expect(s.page.getByText("aguardando correção")).toBeVisible();
  await expect(s.page.getByText(/liberadas depois do prazo/)).toBeVisible(); // política after_due
  await expect(s.page.getByText("Somando dois com dois")).toHaveCount(0);

  // XP do quiz: uma vez, sem duplicar na segunda tentativa
  const before = await xpSum();
  await s.page.getByRole("button", { name: "Nova tentativa" }).click();
  await s.page.getByLabel("B) 4").check();
  await s.page.getByLabel("Verdadeiro").check();
  await s.page.getByLabel("Resposta da questão 3").fill("Brasília");
  await s.page.getByRole("button", { name: "Enviar respostas" }).click();
  await expect(s.page.getByRole("heading", { name: /Tentativa 2 — 5 de 10/ })).toBeVisible();
  expect(await xpSum()).toBe(before); // sem XP duplicado
  expect((await sql`select count(*)::int n from xp_events where student_id = ${hugo.student_id} and kind = 'quiz_done'`)[0].n).toBe(1);
  await expect(s.page.getByText(/Você já usou as 2 tentativas/)).toBeVisible();
  // responsável acompanha, não responde
  await g.page.goto(`/portal/quizzes/${quizId}`);
  await expect(g.page.getByText(/Somente o aluno responde/)).toBeVisible();
  await expect(g.page.getByRole("button", { name: "Nova tentativa" })).toHaveCount(0);

  // professor corrige a discursiva da tentativa 1
  await t.goto(quizUrl);
  await expect(t.getByText("Desempenho por questão")).toBeVisible();
  await t.getByLabel("Nota da discursiva de Hugo Alves").first().fill("3");
  await t.getByRole("row", { name: /Hugo Alves.*1/ }).first().getByRole("button", { name: "Salvar" }).click();
  await expect(t.getByText("Correção salva.")).toBeVisible();
  await s.page.goto(`/portal/quizzes/${quizId}`);
  await expect(s.page.getByRole("heading", { name: /Tentativa 1 — 7 de 10/ })).toBeVisible();

  // prazo vencido bloqueia novas tentativas; tempo esgotado encerra a tentativa
  console.log("STEP tempo");
  const timedUrl = await newQuiz(t, classId, "Quiz cronometrado", { limit: 5, items: "simple" });
  const timedId = timedUrl.split("/").pop()!;
  await s.page.goto(`/portal/quizzes/${timedId}`);
  await s.page.getByRole("button", { name: "Começar quiz" }).click();
  await expect(s.page.getByRole("timer")).toBeVisible();
  await s.page.getByLabel("B) 4").check();
  await sql`update quiz_attempts set deadline_at = now() - interval '5 minutes' where quiz_id = ${timedId}`;
  await s.page.getByRole("button", { name: "Enviar respostas" }).click();
  await expect(s.page.getByText(/O tempo acabou antes do envio/)).toBeVisible();
  await s.page.goto(`/portal/quizzes/${timedId}`);
  await expect(s.page.getByText(/Você já usou a única tentativa/)).toBeVisible();
  expect((await sql`select status from quiz_attempts where quiz_id = ${timedId}`)[0].status).toBe("expired");
  const lateUrl = await newQuiz(t, classId, "Quiz vencido", { items: "simple" });
  await sql`update quizzes set due_at = now() - interval '1 day' where id = ${lateUrl.split("/").pop()!}`;
  await s.page.goto(`/portal/quizzes/${lateUrl.split("/").pop()!}`);
  await expect(s.page.getByText(/O prazo deste quiz terminou/)).toBeVisible();
  await expect(s.page.getByRole("button", { name: "Começar quiz" })).toHaveCount(0);

  /* ---------- Gamificação ---------- */
  console.log("STEP gamificacao");
  await s.page.goto("/portal/conquistas");
  const total = await xpSum();
  await expect(s.page.getByText(`${total} XP`, { exact: true })).toBeVisible();
  await expect(s.page.getByText(/Primeiro quiz/).first()).toBeVisible();
  await expect(s.page.getByText("Desbloqueada em").first()).toBeVisible();
  await expect(s.page.getByText(/Missão: Concluir um quiz hoje/)).toBeVisible();
  expect((await sql`select count(*)::int n from achievement_unlocks where student_id = ${hugo.student_id} and achievement_id = 'primeiro-quiz'`)[0].n).toBe(1);
  expect((await sql`select count(*)::int n from xp_events where student_id = ${hugo.student_id} and ref_key = 'ach:primeiro-quiz'`)[0].n).toBe(1);
  // o extrato soma o total: cada ponto tem motivo
  expect((await sql`select count(*)::int n from xp_events where student_id = ${hugo.student_id} and (label is null or label = '')`)[0].n).toBe(0);
  // ranking desligado por padrão; ligado mostra só primeiro nome
  await g.page.goto("/portal/conquistas");
  await expect(g.page.getByText("Ranking da turma")).toHaveCount(0);
  await t.goto("/app/escola");
  await t.getByLabel(/Mostrar ranking da turma/).check();
  await t.getByRole("button", { name: "Salvar regras do portal" }).click();
  await expect(t.getByText("Regras do portal salvas.")).toBeVisible();
  await s.page.goto("/portal/conquistas");
  await expect(s.page.getByText("Ranking da turma")).toBeVisible();
  await expect(s.page.getByText(/1º Hugo — \d+ XP \(você\)/)).toBeVisible();
  await expect(s.page.locator("ol").getByText("Alves")).toHaveCount(0);
  // painel do professor vê a turma
  await t.goto(`/app/turmas/${classId}/engajamento`);
  await expect(t.getByRole("row", { name: /Hugo Alves/ })).toContainText(String(total));
  // escola desliga: nada de XP novo e a página explica
  await t.goto("/app/escola");
  await t.getByLabel(/Ativar conquistas, XP e missões/).uncheck();
  await t.getByRole("button", { name: "Salvar regras do portal" }).click();
  await expect(t.getByText("Regras do portal salvas.")).toBeVisible();
  const frozen = await xpSum();
  await sql`delete from xp_events where student_id = ${hugo.student_id} and kind = 'access' and day = current_date`; // simula novo dia
  await s.page.goto("/portal");
  expect(await xpSum()).toBe(frozen - 5); // sem XP novo com a gamificação desligada
  await s.page.goto("/portal/conquistas");
  await expect(s.page.getByText(/não ativou conquistas/)).toBeVisible();
});
