import { test, expect } from "@playwright/test";
import { signup, createClass, addStudents } from "./helpers";

test("SA-04: homônimos, célula vazia, zero e valor inválido na importação; prévia antes de gravar", async ({ page }) => {
  await signup(page);
  const classId = await createClass(page, "8º A");

  // lista com homônimos (mesmo nome, matrículas diferentes)
  await page.goto(`/app/turmas/${classId}/alunos`);
  await page.getByLabel("Lista de alunos").fill("Ana Silva;1001\nAna Silva;1002\nBruno Souza;1003\nCarla Dias;1004");
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.locator("td .badge", { hasText: "homônimo" })).toHaveCount(1);
  await expect(page.locator("td .badge", { hasText: "novo" })).toHaveCount(3);
  // homônimo não é incluído por padrão e nada foi gravado antes de confirmar
  await expect(page.getByText(/3 de 4 linha\(s\) serão adicionadas/)).toBeVisible();
  await page.getByRole("button", { name: "Adicionar selecionados" }).click();
  await expect(page.getByText("3 aluno(s) adicionado(s).")).toBeVisible();
  // confirmar o homônimo individualmente como outra pessoa
  await page.getByLabel("Nome", { exact: true }).fill("Ana Silva");
  await page.getByLabel(/Matrícula ou identificador/).fill("1002");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText(/Já existe aluno com este nome/)).toBeVisible();
  await page.getByLabel("É outra pessoa (confirmar homônimo)").check();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText("1 aluno(s) adicionado(s).")).toBeVisible();

  // atividade + importação CSV (vírgula decimal, vazio, zero, não encontrado, inválido)
  await page.goto(`/app/turmas/${classId}/notas`);
  await page.getByLabel("Atividade", { exact: true }).fill("Prova 1");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText("Prova 1 · peso 1 · máx 10")).toBeVisible();
  const csv = "Matrícula;Nota\n1001;7,5\n1002;\n1003;0\n9999;5\n1004;abc\n";
  await page.getByLabel("Arquivo (.csv ou .xlsx)").setInputFiles({ name: "notas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Ler arquivo" }).click();
  await expect(page.getByText(/5 linha\(s\) lidas/)).toBeVisible();
  await page.getByLabel("Identificar por").selectOption("registration");
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.getByText(/Novos: 2 · Atualizações: 0 · Vazios: 1 · Erros: 2/)).toBeVisible();
  await expect(page.getByText("Aluno não encontrado nesta turma.")).toBeVisible();
  await expect(page.getByText(/fora da faixa|inválido/)).toBeVisible();
  await page.getByRole("button", { name: /Salvar somente linhas válidas \(2\)/ }).click();
  await expect(page.getByText("2 nota(s) importada(s).")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Ana Silva — Prova 1").first()).toHaveValue("7,5");
  await expect(page.getByLabel("Bruno Souza — Prova 1")).toHaveValue("0"); // zero registrado
  await expect(page.getByLabel("Carla Dias — Prova 1")).toHaveValue(""); // erro de leitura: pendente, não zero

  // reimportar o mesmo arquivo não duplica; mostra igual
  await page.getByLabel("Arquivo (.csv ou .xlsx)").setInputFiles({ name: "notas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Ler arquivo" }).click();
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.getByText(/Novos: 0/)).toBeVisible();
  await expect(page.getByText("Mesmo valor já lançado.")).toHaveCount(2);
});

test("SA-05: média ponderada 7,5×0,60 + 9,0×0,40 = 8,10, teclado, estados e fechamento", async ({ page, context }) => {
  await signup(page);
  const classId = await createClass(page, "9º C");
  await addStudents(page, classId, "Davi Lima;2001\nElisa Prado;2002");
  await page.goto(`/app/turmas/${classId}/notas`);
  const add = async (title: string, weight: string) => {
    await page.getByLabel("Atividade", { exact: true }).fill(title);
    await page.getByLabel("Peso", { exact: true }).fill(weight);
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByText(new RegExp(`${title} · peso ${weight}`))).toBeVisible();
  };
  await add("Prova", "60");
  await add("Trabalho", "40");

  const davi1 = page.getByLabel("Davi Lima — Prova");
  await davi1.fill("7,5");
  await davi1.press("Enter"); // navega para a linha de baixo
  await expect(page.getByLabel("Elisa Prado — Prova")).toBeFocused();
  await page.getByLabel("Davi Lima — Trabalho").fill("9");
  await page.getByLabel("Davi Lima — Trabalho").press("Tab");
  await expect(page.getByText("7,50 × 0,60 + 9,00 × 0,40 = 8,10")).toBeVisible();
  await expect(page.locator("tr", { hasText: "Davi Lima" }).locator("td").last()).toContainText("8,1");

  // valor inválido e fora da faixa
  await page.getByLabel("Elisa Prado — Prova").fill("11");
  await page.getByLabel("Elisa Prado — Prova").press("Tab");
  await expect(page.getByRole("alert").filter({ hasText: /fora da faixa/ })).toBeVisible();

  // estados distintos: ausente (F), não entregue (N), pendente (vazio) — e média parcial
  await page.getByLabel("Elisa Prado — Prova").fill("F");
  await page.getByLabel("Elisa Prado — Trabalho").fill("6");
  await page.getByLabel("Elisa Prado — Trabalho").press("Tab");
  await expect(page.locator("tr", { hasText: "Elisa Prado" }).getByText("parcial")).toBeVisible();

  // exportação CSV com vírgula decimal
  const cookies = await context.cookies();
  const authed = await (await import("@playwright/test")).request.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") } });
  const res = await authed.get(`/api/export/notas?turma=${classId}&periodo=${encodeURIComponent("1º bimestre")}`);
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain("Davi Lima;");
  expect(body).toMatch(/Davi Lima;7,5;9;8,1;não/);
  expect(body).toMatch(/Elisa Prado;F;6;6;sim/);

  // fechamento trava edição; reabertura exige motivo
  await page.reload();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Confirmar e fechar período" }).click();
  await expect(page.getByText(/Período fechado/)).toBeVisible();
  await expect(page.getByLabel("Davi Lima — Prova")).toBeDisabled();
  await page.getByLabel("Motivo da reabertura").fill("Correção de lançamento");
  await page.getByRole("button", { name: "Reabrir período" }).click();
  await expect(page.getByLabel("Davi Lima — Prova")).toBeEnabled();
});
