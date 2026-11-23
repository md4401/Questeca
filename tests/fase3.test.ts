import { describe, it, expect } from "vitest";
import { levelOf, leagueOf, computeStreak, missionProgress, MISSIONS, newlyUnlocked, rank, quizXp, periodKey, XP_RULES } from "@/lib/core/gamification";
import { gradeItem, scoreAttempt, validateQuiz, canStart, withinTime, canSeeExplanations } from "@/lib/core/quiz";
import type { QuizItem } from "@/db/schema";

describe("gamificação", () => {
  it("nível = floor(XP/100)+1 e ligas por faixa", () => {
    expect([0, 99, 100, 450].map(levelOf)).toEqual([1, 1, 2, 5]);
    expect(leagueOf(0).name).toBe("Bronze"); expect(leagueOf(300).name).toBe("Prata"); expect(leagueOf(2499).name).toBe("Platina"); expect(leagueOf(2500).next).toBeNull();
    expect(quizXp(100)).toBe(XP_RULES.quiz_done + 10 + XP_RULES.quiz_perfect); expect(quizXp(50)).toBe(15);
  });
  it("sequência ignora fim de semana e feriado, e dá folga até o fim do dia", () => {
    // 2026-03-06 sexta, 03-05 quinta, 03-04 quarta; 03-09 segunda
    const act = new Set(["2026-03-04", "2026-03-05", "2026-03-06"]);
    expect(computeStreak(act, "2026-03-06")).toBe(3);
    expect(computeStreak(act, "2026-03-07")).toBe(3); // sábado não quebra
    expect(computeStreak(act, "2026-03-09")).toBe(3); // segunda ainda sem atividade: continua
    expect(computeStreak(new Set(["2026-03-04", "2026-03-06"]), "2026-03-06")).toBe(1); // quinta faltou
    expect(computeStreak(new Set(["2026-03-04", "2026-03-06"]), "2026-03-06", new Set(["2026-03-05"]))).toBe(2); // quinta foi feriado
    expect(computeStreak(new Set(), "2026-03-06")).toBe(0);
  });
  it("missões: progresso por período e dias distintos", () => {
    const m = (id: string) => MISSIONS.find((x) => x.id === id)!;
    expect(missionProgress(m("d-tarefa"), [{ kind: "task_on_time", day: "2026-03-02" }])).toEqual({ n: 1, done: true });
    expect(missionProgress(m("w-estudo"), [{ kind: "access", day: "2026-03-02" }, { kind: "access", day: "2026-03-02" }, { kind: "access", day: "2026-03-03" }])).toEqual({ n: 2, done: false });
    expect(missionProgress(m("w-tarefas"), Array.from({ length: 7 }, () => ({ kind: "task_late", day: "2026-03-02" })))).toEqual({ n: 5, done: true });
    expect(periodKey(m("w-quizzes"), "2026-03-04")).toBe("2026-03-02"); expect(periodKey(m("d-quiz"), "2026-03-04")).toBe("2026-03-04");
  });
  it("conquistas só desbloqueiam uma vez e ranking não expõe sobrenome", () => {
    const c = { access: 1, tasks: 1, tasksOnTime: 1, perfect: 0, quizzes: 0, attendance: 0, studyDays: 1, xp: 120, streak: 1 };
    expect(newlyUnlocked(c, new Set()).map((a) => a.id)).toEqual(["primeira-entrega"]);
    expect(newlyUnlocked(c, new Set(["primeira-entrega"]))).toEqual([]);
    const r = rank([{ id: "a", name: "Ana Souza", xp: 50 }, { id: "b", name: "Beto Lima", xp: 50 }, { id: "c", name: "Cida Reis", xp: 90 }]);
    expect(r.map((x) => `${x.pos}:${x.display}`)).toEqual(["1:Cida", "2:Ana", "2:Beto"]);
  });
});

describe("quiz", () => {
  const items: QuizItem[] = [
    { id: "a", type: "mc", prompt: "2+2", options: ["3", "4"], answer: 1, points: 2 },
    { id: "b", type: "tf", prompt: "0,5 = 1/2", answer: true, points: 1 },
    { id: "c", type: "challenge", prompt: "Capital do Brasil", answer: ["Brasília", "brasilia"], points: 2 },
    { id: "d", type: "text", prompt: "Explique", points: 5 },
  ];
  it("correção automática, desafio sem acento e discursiva pendente", () => {
    expect(gradeItem(items[0], 1)).toBe(true); expect(gradeItem(items[0], 0)).toBe(false); expect(gradeItem(items[0], undefined)).toBe(false);
    expect(gradeItem(items[1], true)).toBe(true); expect(gradeItem(items[1], "true")).toBe(true); expect(gradeItem(items[1], false)).toBe(false);
    expect(gradeItem(items[2], "  BRASÍLIA ")).toBe(true); expect(gradeItem(items[2], "Rio")).toBe(false); expect(gradeItem(items[3], "texto")).toBeNull();
    const r = scoreAttempt(items, { a: 1, b: false, c: "brasilia", d: "minha explicação" });
    expect(r).toMatchObject({ score: 4, max: 10, review: true });
    expect(scoreAttempt(items, { a: 1, b: true, c: "brasilia", d: "x" }, { d: 4 })).toMatchObject({ score: 9, review: false });
    expect(scoreAttempt(items, { a: 1 }, {}).review).toBe(false); // discursiva em branco não pede revisão
  });
  it("validação do quiz", () => {
    expect(validateQuiz([])).toMatch(/ao menos uma/);
    expect(validateQuiz(items)).toBeNull();
    expect(validateQuiz([{ id: "x", type: "tf", prompt: "?", points: 1 }])).toMatch(/verdadeira ou falsa/);
    expect(validateQuiz([{ id: "x", type: "challenge", prompt: "?", answer: [" "], points: 1 }])).toMatch(/resposta aceita/);
  });
  it("tentativas, prazo, tempo e explicações", () => {
    const now = new Date("2026-03-10T12:00:00Z"); const q = { status: "published", dueAt: new Date("2026-03-11T12:00:00Z"), maxAttempts: 2 };
    expect(canStart(q, [], now)).toEqual({ ok: true, attemptNo: 1 });
    expect(canStart(q, [{ attemptNo: 1, status: "submitted", deadlineAt: null }], now)).toEqual({ ok: true, attemptNo: 2 });
    expect(canStart(q, [{ attemptNo: 1, status: "submitted", deadlineAt: null }, { attemptNo: 2, status: "submitted", deadlineAt: null }], now).ok).toBe(false);
    expect(canStart(q, [{ attemptNo: 1, status: "in_progress", deadlineAt: new Date("2026-03-10T12:30:00Z") }], now)).toEqual({ ok: true, attemptNo: 1, resume: true });
    expect(canStart(q, [{ attemptNo: 1, status: "in_progress", deadlineAt: new Date("2026-03-10T11:00:00Z") }, ], now)).toMatchObject({ ok: true, attemptNo: 2 });
    expect(canStart(q, [], new Date("2026-03-12T00:00:00Z")).ok).toBe(false);
    expect(canStart({ ...q, status: "draft" }, [], now).ok).toBe(false);
    expect(withinTime(new Date("2026-03-10T12:00:00Z"), new Date("2026-03-10T12:00:10Z"))).toBe(true);
    expect(withinTime(new Date("2026-03-10T12:00:00Z"), new Date("2026-03-10T12:01:00Z"))).toBe(false);
    expect(canSeeExplanations("after_due", q.dueAt, now)).toBe(false); expect(canSeeExplanations("after_due", q.dueAt, new Date("2026-03-12T00:00:00Z"))).toBe(true);
    expect(canSeeExplanations("never", null, now)).toBe(false);
  });
});

import { riskOf, distribution, mean, thresholdsFrom } from "@/lib/core/analytics";
describe("indicadores de atenção", () => {
  const t = thresholdsFrom({ minAttendance: 75, minAverage: 6, maxLateTasks: 2 });
  it("explica cada critério e não infere sem dados", () => {
    expect(riskOf({ average: null, averagePartial: false, attendancePct: null, lateTasks: 0 }, t)).toEqual({ level: "sem_dados", reasons: ["Sem dados suficientes para sinalizar."] });
    expect(riskOf({ average: 8, averagePartial: false, attendancePct: 90, lateTasks: 0 }, t).level).toBe("ok");
    const one = riskOf({ average: 5.5, averagePartial: true, attendancePct: 90, lateTasks: 0 }, t);
    expect(one.level).toBe("atencao"); expect(one.reasons[0]).toMatch(/Média 5,5 \(parcial\) abaixo de 6/);
    const two = riskOf({ average: 4, averagePartial: false, attendancePct: 60, lateTasks: 3 }, t);
    expect(two.level).toBe("alerta"); expect(two.reasons).toHaveLength(3);
    expect(riskOf({ average: null, averagePartial: false, attendancePct: 60, lateTasks: 0 }, t).reasons[0]).toMatch(/Frequência 60%/);
  });
  it("limites vêm da escola, com a nota de aprovação como padrão", () => {
    expect(thresholdsFrom(undefined, 7).minAverage).toBe(7); expect(thresholdsFrom({ minAverage: 5 }, 7).minAverage).toBe(5); expect(thresholdsFrom(undefined).minAttendance).toBe(75);
  });
  it("distribuição e média", () => {
    expect(distribution([0, 1.9, 2, 5, 10], 10).map((b) => b.n)).toEqual([2, 1, 1, 0, 1]);
    expect(mean([2, 4])).toBe(3); expect(mean([])).toBeNull();
  });
});
