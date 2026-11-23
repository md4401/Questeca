/** Regras puras de XP, níveis, ligas, sequência, missões e conquistas. Sem punição: XP conquistado nunca diminui. */
import { addDaysISO, isoWeekday, weekStart } from "@/lib/core/calendar";

export const XP_PER_LEVEL = 100;
export const levelOf = (xp: number) => Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
export const levelProgress = (xp: number) => ({ level: levelOf(xp), into: Math.max(0, xp) % XP_PER_LEVEL, next: XP_PER_LEVEL });

export const LEAGUES = [
  { id: "bronze", name: "Bronze", min: 0 }, { id: "prata", name: "Prata", min: 300 }, { id: "ouro", name: "Ouro", min: 800 }, { id: "platina", name: "Platina", min: 1500 }, { id: "diamante", name: "Diamante", min: 2500 },
] as const;
export function leagueOf(xp: number) { let cur: (typeof LEAGUES)[number] = LEAGUES[0]; for (const l of LEAGUES) if (xp >= l.min) cur = l; const i = LEAGUES.indexOf(cur); return { ...cur, next: LEAGUES[i + 1] ?? null }; }

/** Pontos por tipo de evento (regras transparentes e configuráveis no código). */
export const XP_RULES = { access: 5, task_on_time: 20, task_late: 10, task_graded_perfect: 10, quiz_done: 10, quiz_perfect: 10, attendance: 5, study: 5, participation: 3 } as const;
export const PARTICIPATION_DAILY_CAP = 3;
export const quizXp = (pct: number) => XP_RULES.quiz_done + Math.round(pct / 10) + (pct >= 100 ? XP_RULES.quiz_perfect : 0);

/**
 * Sequência de dias letivos com atividade. Fins de semana e dias de pausa (feriados) não contam nem quebram.
 * Se hoje ainda não teve atividade, a sequência de ontem continua valendo até o fim do dia.
 */
export function computeStreak(activeDays: Set<string>, today: string, pause: Set<string> = new Set()): number {
  const lective = (d: string) => isoWeekday(d) <= 5 && !pause.has(d);
  let day = today; let n = 0;
  if (lective(day) && !activeDays.has(day)) day = addDaysISO(day, -1);
  for (let guard = 0; guard < 800; guard++) {
    if (!lective(day)) { day = addDaysISO(day, -1); continue; }
    if (!activeDays.has(day)) break;
    n++; day = addDaysISO(day, -1);
  }
  return n;
}

export type Counters = { access: number; tasks: number; tasksOnTime: number; perfect: number; quizzes: number; attendance: number; studyDays: number; xp: number; streak: number };

export type Achievement = { id: string; name: string; desc: string; icon: string; category: "entrega" | "quiz" | "constancia" | "presenca" | "nivel" | "nota"; rarity: "comum" | "rara" | "epica"; reward: number; check: (c: Counters) => boolean };
export const ACHIEVEMENTS: Achievement[] = [
  { id: "primeira-entrega", name: "Primeira entrega", desc: "Entregue sua primeira tarefa.", icon: "📨", category: "entrega", rarity: "comum", reward: 10, check: (c) => c.tasks >= 1 },
  { id: "cinco-entregas", name: "Cinco entregas", desc: "Entregue 5 tarefas.", icon: "📚", category: "entrega", rarity: "comum", reward: 20, check: (c) => c.tasks >= 5 },
  { id: "no-prazo-3", name: "Sempre no prazo", desc: "Entregue 3 tarefas dentro do prazo.", icon: "⏱️", category: "entrega", rarity: "rara", reward: 30, check: (c) => c.tasksOnTime >= 3 },
  { id: "nota-perfeita", name: "Nota perfeita", desc: "Tire a nota máxima em uma tarefa ou quiz.", icon: "🌟", category: "nota", rarity: "rara", reward: 30, check: (c) => c.perfect >= 1 },
  { id: "primeiro-quiz", name: "Primeiro quiz", desc: "Conclua um quiz.", icon: "🧩", category: "quiz", rarity: "comum", reward: 10, check: (c) => c.quizzes >= 1 },
  { id: "cinco-quizzes", name: "Praticante", desc: "Conclua 5 quizzes.", icon: "🎯", category: "quiz", rarity: "rara", reward: 30, check: (c) => c.quizzes >= 5 },
  { id: "constancia-3", name: "Constância", desc: "Acesse por 3 dias letivos seguidos.", icon: "🔥", category: "constancia", rarity: "comum", reward: 15, check: (c) => c.streak >= 3 },
  { id: "constancia-7", name: "Semana firme", desc: "Acesse por 7 dias letivos seguidos.", icon: "🏅", category: "constancia", rarity: "epica", reward: 50, check: (c) => c.streak >= 7 },
  { id: "presenca-10", name: "Presença constante", desc: "Tenha 10 presenças registradas.", icon: "✅", category: "presenca", rarity: "rara", reward: 30, check: (c) => c.attendance >= 10 },
  { id: "nivel-5", name: "Nível 5", desc: "Chegue ao nível 5.", icon: "🚀", category: "nivel", rarity: "epica", reward: 40, check: (c) => levelOf(c.xp) >= 5 },
];

export type MissionDef = { id: string; period: "daily" | "weekly"; name: string; goal: number; reward: number; counts: (k: string) => boolean; distinctDays?: boolean };
export const MISSIONS: MissionDef[] = [
  { id: "d-acessar", period: "daily", name: "Acessar o portal hoje", goal: 1, reward: 5, counts: (k) => k === "access" },
  { id: "d-tarefa", period: "daily", name: "Entregar uma tarefa hoje", goal: 1, reward: 10, counts: (k) => k === "task_on_time" || k === "task_late" },
  { id: "d-quiz", period: "daily", name: "Concluir um quiz hoje", goal: 1, reward: 10, counts: (k) => k === "quiz_done" },
  { id: "w-tarefas", period: "weekly", name: "Entregar 5 tarefas na semana", goal: 5, reward: 40, counts: (k) => k === "task_on_time" || k === "task_late" },
  { id: "w-quizzes", period: "weekly", name: "Concluir 3 quizzes na semana", goal: 3, reward: 30, counts: (k) => k === "quiz_done" },
  { id: "w-estudo", period: "weekly", name: "Estudar em 5 dias da semana", goal: 5, reward: 40, counts: (k) => k === "access", distinctDays: true },
];
export const periodKey = (m: MissionDef, today: string) => (m.period === "daily" ? today : weekStart(today));
export const periodRange = (m: MissionDef, today: string) => (m.period === "daily" ? { from: today, to: today } : { from: weekStart(today), to: addDaysISO(weekStart(today), 6) });

/** Progresso de uma missão a partir do extrato do período. */
export function missionProgress(m: MissionDef, events: { kind: string; day: string }[]) {
  const hit = events.filter((e) => m.counts(e.kind));
  const n = m.distinctDays ? new Set(hit.map((e) => e.day)).size : hit.length;
  return { n: Math.min(n, m.goal), done: n >= m.goal };
}

/** Conquistas que passaram a valer e ainda não foram desbloqueadas. */
export const newlyUnlocked = (c: Counters, already: Set<string>) => ACHIEVEMENTS.filter((a) => !already.has(a.id) && a.check(c));

/** Ranking opcional: sem exposição de sobrenome; empates dividem a posição. */
export function rank(rows: { id: string; name: string; xp: number }[]) {
  const sorted = [...rows].sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
  let pos = 0; let last = -1;
  return sorted.map((r, i) => { if (r.xp !== last) { pos = i + 1; last = r.xp; } return { ...r, pos, display: r.name.split(" ")[0] }; });
}
