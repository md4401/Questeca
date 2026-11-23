/** Indicadores de atenção (puros). São apoio à decisão do professor: nunca diagnóstico nem aprovação automática. */
export type Thresholds = { minAttendance: number; minAverage: number; maxLateTasks: number };
export const DEFAULT_THRESHOLDS: Thresholds = { minAttendance: 75, minAverage: 6, maxLateTasks: 2 };
export const thresholdsFrom = (r: { minAttendance?: number; minAverage?: number; maxLateTasks?: number } | undefined, passMark?: number): Thresholds => ({ minAttendance: r?.minAttendance ?? DEFAULT_THRESHOLDS.minAttendance, minAverage: r?.minAverage ?? passMark ?? DEFAULT_THRESHOLDS.minAverage, maxLateTasks: r?.maxLateTasks ?? DEFAULT_THRESHOLDS.maxLateTasks });

export type Signals = { average: number | null; averagePartial: boolean; attendancePct: number | null; lateTasks: number };
export type Risk = { level: "ok" | "atencao" | "alerta" | "sem_dados"; reasons: string[] };

const n1 = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");
/** Cada alerta cita o critério e o valor. Sem dado, não se infere nada ("sem dados suficientes"). */
export function riskOf(s: Signals, t: Thresholds): Risk {
  if (s.average == null && s.attendancePct == null && s.lateTasks === 0) return { level: "sem_dados", reasons: ["Sem dados suficientes para sinalizar."] };
  const reasons: string[] = [];
  if (s.attendancePct != null && s.attendancePct < t.minAttendance) reasons.push(`Frequência ${n1(s.attendancePct)}% (mínimo configurado: ${n1(t.minAttendance)}%).`);
  if (s.average != null && s.average < t.minAverage) reasons.push(`Média ${n1(s.average)}${s.averagePartial ? " (parcial)" : ""} abaixo de ${n1(t.minAverage)}.`);
  if (s.lateTasks > t.maxLateTasks) reasons.push(`${s.lateTasks} tarefas atrasadas (limite: ${t.maxLateTasks}).`);
  return { level: reasons.length === 0 ? "ok" : reasons.length === 1 ? "atencao" : "alerta", reasons };
}

/** Distribuição de notas em faixas iguais da escala. */
export function distribution(values: number[], scaleMax: number, buckets = 5) {
  const out = Array.from({ length: buckets }, (_, i) => ({ from: (scaleMax / buckets) * i, to: (scaleMax / buckets) * (i + 1), n: 0 }));
  for (const v of values) { const i = Math.min(buckets - 1, Math.max(0, Math.floor((v / scaleMax) * buckets))); out[i].n++; }
  return out;
}
export const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
