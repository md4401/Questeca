import "server-only";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { lessonLogs, observations, documents } from "@/db/schema";
import { loadGradebook, rulesFrom } from "@/lib/gradebook";
import { classStudents } from "@/lib/access";
import { topicName } from "@/lib/taxonomy";
import { fmtDate, fmtNum } from "@/lib/format";
import type { OrgSettings } from "@/db/schema";

export const DOC_KINDS: Record<string, { label: string; needsStudent?: boolean; needsPeriod?: boolean }> = {
  plano: { label: "Plano de aula/bimestral", needsPeriod: true },
  diario: { label: "Diário de aula", needsPeriod: true },
  andamento: { label: "Andamento do conteúdo", needsPeriod: true },
  relatorio: { label: "Relatório individual", needsStudent: true, needsPeriod: true },
  conselho: { label: "Conselho de classe (resumo e minuta de ata)", needsPeriod: true },
  fechamento: { label: "Fechamento do período (pendências)", needsPeriod: true },
  familia: { label: "Pauta e devolutiva para famílias", needsStudent: true },
};

export type Built = { title: string; body: string; evidence: { label: string; source: string }[]; gaps: string[] };

export async function buildDocument(kind: string, o: { cls: { id: string; name: string; grade: string; year: number }; settings: OrgSettings; period?: string; studentId?: string; viewerId: string; viewerIsCoordinator: boolean }): Promise<Built> {
  const rules = rulesFrom(o.settings);
  const period = o.period || rules.periods[0];
  const school = o.settings.header?.schoolName ?? "Escola";
  const logs = await db.select().from(lessonLogs).where(eq(lessonLogs.classId, o.cls.id)).orderBy(desc(lessonLogs.taughtOn)).limit(60);
  const obsAll = await db.select().from(observations).where(eq(observations.classId, o.cls.id)).orderBy(desc(observations.observedOn));
  const obs = obsAll.filter((x) => x.authorId === o.viewerId || x.visibility === "school" || o.viewerIsCoordinator);
  const studs = await classStudents(o.cls.id);
  const student = o.studentId ? studs.find((s) => s.id === o.studentId) : undefined;
  const gb = await loadGradebook(o.cls.id, period, rules);
  const evidence: Built["evidence"] = []; const gaps: string[] = [];
  const head = `${school}\nTurma: ${o.cls.name} · Matemática · ${o.cls.year}\nPeríodo: ${period}\n`;

  if (kind === "diario" || kind === "andamento" || kind === "plano") {
    if (!logs.length) gaps.push("Nenhuma aula registrada no diário desta turma.");
    logs.forEach((l) => evidence.push({ label: `Aula de ${fmtDate(l.taughtOn)}`, source: "Diário da turma" }));
  }
  if (kind === "plano") {
    const topics = [...new Set(logs.flatMap((l) => l.topics))];
    gaps.push("Calendário, quantidade de aulas e materiais não foram informados — complete antes de entregar.");
    return { title: `Plano — ${o.cls.name} — ${period}`, evidence, gaps, body: `${head}\nObjetivos e conteúdos (a partir do que já foi registrado):\n${topics.length ? topics.map((t) => `• ${topicName(t)}`).join("\n") : "• (preencher)"}\n\nSequência didática:\n• (preencher)\n\nAvaliação prevista:\n• (preencher)\n` };
  }
  if (kind === "diario") {
    return { title: `Diário — ${o.cls.name} — ${period}`, evidence, gaps, body: `${head}\nRegistros de aula:\n${logs.length ? logs.map((l) => `${fmtDate(l.taughtOn)} — ${l.content}${l.topics.length ? ` [${l.topics.map(topicName).join(", ")}]` : ""}`).join("\n") : "(sem registros)"}\n` };
  }
  if (kind === "andamento") {
    const planned = logs.filter((l) => l.planned).length; const extra = logs.length - planned;
    const [plan] = await db.select().from(documents).where(and(eq(documents.classId, o.cls.id), eq(documents.kind, "plano"), eq(documents.status, "approved"))).limit(1);
    if (!plan) gaps.push("Não há plano aprovado desta turma para comparar o planejado com o realizado.");
    return { title: `Andamento — ${o.cls.name} — ${period}`, evidence, gaps, body: `${head}\nAulas registradas: ${logs.length} (${planned} previstas no planejamento, ${extra} fora do planejamento).\nConteúdos trabalhados:\n${[...new Set(logs.flatMap((l) => l.topics))].map((t) => `• ${topicName(t)}`).join("\n") || "• (nenhum conteúdo confirmado)"}\n\nPontos pendentes e revisão por disciplina:\n• (preencher)\n` };
  }
  if (kind === "relatorio" || kind === "familia") {
    if (!student) return { title: "Relatório", body: "Escolha um aluno.", evidence, gaps: ["Aluno não informado."] };
    const sObs = obs.filter((x) => x.studentId === student.id);
    sObs.forEach((x) => evidence.push({ label: `Observação de ${fmtDate(x.observedOn)}`, source: "Observações da turma" }));
    const row = gb.rows.find((r) => r.student.id === student.id);
    if (row) evidence.push({ label: `Notas de ${period}`, source: "Registro de notas" });
    if (!sObs.length) gaps.push("Sem observações datadas deste aluno no período.");
    if (!row || row.computed.average == null) gaps.push("Sem notas lançadas neste período.");
    const grades = gb.items.map((it, i) => `${it.title}: ${row?.cells[i]?.state === "value" ? fmtNum(row.cells[i].value) : row?.cells[i]?.state === "zero" ? "0" : row?.cells[i]?.state === "absent" ? "ausente" : row?.cells[i]?.state === "not_delivered" ? "não entregue" : "pendente"}`);
    if (kind === "familia") {
      return { title: `Devolutiva — ${student.name}`, evidence, gaps: [...gaps, "A entrega e o canal são decididos pelo professor ou pela coordenação."], body: `${head}\nAluno(a): ${student.name}\n\nPauta da conversa:\n${sObs.map((x) => `• ${fmtDate(x.observedOn)}: ${x.text}`).join("\n") || "• (preencher com fatos observados)"}\n\nDesempenho no período:\n${grades.join("\n") || "(sem atividades)"}\nMédia: ${row?.computed.average != null ? fmtNum(row.computed.average) : "—"}${row?.computed.partial ? " (parcial)" : ""}\n\nEncaminhamentos combinados:\n• (preencher)\n` };
    }
    return { title: `Relatório individual — ${student.name} — ${period}`, evidence, gaps, body: `${head}\nAluno(a): ${student.name}\n\nObservações registradas:\n${sObs.map((x) => `• ${fmtDate(x.observedOn)}: ${x.text}`).join("\n") || "• (sem registros)"}\n\nDesempenho:\n${grades.join("\n") || "(sem atividades)"}\nMédia do período: ${row?.computed.average != null ? fmtNum(row.computed.average) : "—"}${row?.computed.partial ? " (parcial)" : ""}\n${row?.computed.formula ? `Cálculo: ${row.computed.formula}\n` : ""}\nAções já realizadas:\n• (preencher; fatos não registrados ficam em aberto)\n` };
  }
  if (kind === "conselho") {
    const withAvg = gb.rows.filter((r) => r.computed.average != null);
    const below = withAvg.filter((r) => (r.computed.average ?? 0) < rules.passMark);
    evidence.push({ label: `Notas de ${period}`, source: "Registro de notas" });
    if (!withAvg.length) gaps.push("Sem notas lançadas neste período.");
    gaps.push("Frequência não é registrada na Segunda Lousa: informe quando a escola fornecer.", "As decisões do conselho devem ser registradas na ata após o encontro.");
    const avg = withAvg.length ? withAvg.reduce((a, r) => a + (r.computed.average ?? 0), 0) / withAvg.length : null;
    return { title: `Conselho de classe — ${o.cls.name} — ${period}`, evidence, gaps, body: `${head}\nResumo da turma:\n• Alunos: ${studs.length} · com média calculada: ${withAvg.length}\n• Média da turma: ${avg != null ? fmtNum(avg) : "—"}\n• Abaixo da média (${rules.passMark}): ${below.length}\n\nAlunos para discussão (abaixo da média):\n${below.map((r) => `• ${r.student.name}: ${fmtNum(r.computed.average)}${r.computed.partial ? " (parcial)" : ""}`).join("\n") || "• (nenhum)"}\n\nMinuta de ata — decisões registradas:\n• (preencher após o conselho)\n\nA promoção, a recuperação e os registros oficiais são de responsabilidade da equipe escolar.\n` };
  }
  // fechamento
  const pend: string[] = [];
  gb.rows.forEach((r) => r.computed.ignored.filter((x) => x.why.startsWith("Lançamento")).forEach((x) => pend.push(`${r.student.name} — ${x.title}`)));
  evidence.push({ label: `Pendências de ${period}`, source: "Registro de notas" });
  if (!gb.items.length) gaps.push("Nenhuma atividade cadastrada neste período.");
  return { title: `Fechamento — ${o.cls.name} — ${period}`, evidence, gaps, body: `${head}\nAtividades: ${gb.items.map((i) => `${i.title} (peso ${fmtNum(i.weight)})`).join("; ") || "—"}\n\nPendências (${pend.length}):\n${pend.map((p) => `• ${p}`).join("\n") || "• Nenhuma"}\n\nMédias:\n${gb.rows.map((r) => `${r.student.name}: ${r.computed.average != null ? fmtNum(r.computed.average) : "—"}${r.computed.partial ? " (parcial)" : ""}`).join("\n")}\n\nExportação compatível com o sistema oficial da escola: use o CSV da aba Notas.\n` };
}
