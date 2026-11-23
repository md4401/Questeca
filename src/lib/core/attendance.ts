export type AttStatus = "present" | "absent" | "justified";
export const ATT_LABEL: Record<AttStatus, string> = { present: "Presente", absent: "Falta", justified: "Falta justificada" };
export const DEFAULT_MIN_PCT = 75; // mínimo de frequência da LDB

/** Só conta aulas com chamada registrada: ausência de lançamento nunca vira falta. Falta justificada não é presença. */
export function summarize(records: { status: string }[]) {
  const present = records.filter((r) => r.status === "present").length;
  const justified = records.filter((r) => r.status === "justified").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const total = present + justified + absent;
  return { total, present, absent, justified, pct: total === 0 ? null : Math.round((present / total) * 1000) / 10 };
}
export const isLow = (pct: number | null, min = DEFAULT_MIN_PCT) => pct != null && pct < min;
export const validStatus = (s: string): s is AttStatus => s === "present" || s === "absent" || s === "justified";
