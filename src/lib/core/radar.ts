/** Radar de alunos em risco: queda brusca de nota, faltas seguidas e frequência baixa. Apoio à decisão do professor, nunca diagnóstico. */
export type RadarThresholds = { minAttendance: number; dropPoints: number; consecutiveAbsences: number; passMark: number };
export const DEFAULT_RADAR: RadarThresholds = { minAttendance: 75, dropPoints: 2, consecutiveAbsences: 3, passMark: 6 };
export const radarThresholdsFrom = (r?: { minAttendance?: number; minAverage?: number }, passMark?: number): RadarThresholds => ({
  ...DEFAULT_RADAR, minAttendance: r?.minAttendance ?? DEFAULT_RADAR.minAttendance, passMark: r?.minAverage ?? passMark ?? DEFAULT_RADAR.passMark,
});

const n1 = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

/** Notas já normalizadas para 0–10, em ordem cronológica. Compara a última com a média das até 3 anteriores. */
export function gradeDrop(scores: number[], t: RadarThresholds) {
  if (scores.length < 2) return null;
  const last = scores[scores.length - 1];
  const prev = scores.slice(-4, -1);
  const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;
  const drop = prevAvg - last;
  return drop >= t.dropPoints ? { last, prevAvg, drop } : null;
}

/** Faltas seguidas contando do registro mais recente para trás. Falta justificada não conta nem interrompe; presença interrompe. */
export function consecutiveAbsences(statuses: string[]) {
  let n = 0;
  for (let i = statuses.length - 1; i >= 0; i--) {
    const s = statuses[i];
    if (s === "absent") n++; else if (s === "justified") continue; else break;
  }
  return n;
}

export type RadarInput = { scores: number[]; attendance: string[] }; // attendance: cronológico (present|absent|justified)
export type RadarResult = { level: "ok" | "atencao" | "alerta"; reasons: string[]; flags: { drop: boolean; streak: boolean; lowAttendance: boolean } };

export function radarOf(i: RadarInput, t: RadarThresholds): RadarResult {
  const reasons: string[] = [];
  const d = gradeDrop(i.scores, t);
  if (d) reasons.push(`Queda de nota: de ${n1(d.prevAvg)} (média anterior) para ${n1(d.last)}.`);
  const streak = consecutiveAbsences(i.attendance);
  if (streak >= t.consecutiveAbsences) reasons.push(`${streak} faltas seguidas.`);
  const counted = i.attendance.filter((s) => s !== "justified");
  const pct = counted.length >= 3 ? (counted.filter((s) => s === "present").length / counted.length) * 100 : null;
  const low = pct != null && pct < t.minAttendance;
  if (low) reasons.push(`Frequência ${n1(pct!)}% (mínimo: ${n1(t.minAttendance)}%).`);
  const flags = { drop: !!d, streak: streak >= t.consecutiveAbsences, lowAttendance: low };
  const level = reasons.length === 0 ? "ok" : reasons.length === 1 && !(d && d.last < t.passMark) ? "atencao" : "alerta";
  return { level, reasons, flags };
}
