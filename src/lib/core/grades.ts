export type GradeState = "value" | "zero" | "absent" | "not_delivered" | "pending";

export type GradeCell = { itemId: string; state: GradeState; value: number | null };
export type GradeItemMeta = { id: string; title: string; weight: number; maxPoints: number; period: string; recovery: boolean };

export type Rules = {
  scaleMax: number;
  passMark: number;
  rounding: "none" | "half" | "tenth" | "up_half";
  absenceCounts: "zero" | "exclude";
  notDeliveredCounts: "zero" | "exclude";
  recovery: "none" | "replace_if_higher" | "average" | "independent";
};

export const DEFAULT_RULES: Rules = {
  scaleMax: 10, passMark: 6, rounding: "none", absenceCounts: "exclude", notDeliveredCounts: "zero", recovery: "none",
};

export function applyRounding(v: number, r: Rules["rounding"]) {
  switch (r) {
    case "tenth": return Math.round(v * 10 + 1e-9) / 10;
    case "half": return Math.round(v * 2 + 1e-9) / 2;
    case "up_half": return Math.ceil(v * 2 - 1e-9) / 2;
    default: return Math.round(v * 1000) / 1000;
  }
}

/** Normaliza o valor para a escala da escola (0..scaleMax). */
export function normalized(cell: GradeCell, item: GradeItemMeta, rules: Rules) {
  if (cell.state === "value" && cell.value != null) return (cell.value / item.maxPoints) * rules.scaleMax;
  return null;
}

export type Computed = {
  partial: boolean;
  raw: number | null;
  average: number | null;
  considered: { itemId: string; title: string; value: number; weight: number }[];
  ignored: { itemId: string; title: string; why: string }[];
  formula: string;
  before?: number | null;
  recoveryApplied?: boolean;
  totalWeight: number;
};

const fmt = (n: number) => n.toFixed(2).replace(".", ",");

/** Média ponderada do período com origem dos valores (PRD cap. 19). */
export function computeAverage(cells: GradeCell[], items: GradeItemMeta[], rules: Rules, opts: { expectedItems?: number } = {}): Computed {
  const considered: Computed["considered"] = [];
  const ignored: Computed["ignored"] = [];
  let recoveryCell: { item: GradeItemMeta; value: number } | null = null;

  const cellMap = new Map(cells.map((c) => [c.itemId, c]));
  for (const item of items) {
    const cell = cellMap.get(item.id) ?? { itemId: item.id, state: "pending" as GradeState, value: null };
    let v: number | null = null;
    if (cell.state === "value") v = normalized(cell, item, rules);
    else if (cell.state === "zero") v = 0;
    else if (cell.state === "absent") { if (rules.absenceCounts === "zero") v = 0; else ignored.push({ itemId: item.id, title: item.title, why: "Ausência (não conta na média)" }); }
    else if (cell.state === "not_delivered") { if (rules.notDeliveredCounts === "zero") v = 0; else ignored.push({ itemId: item.id, title: item.title, why: "Não entregue (não conta na média)" }); }
    else ignored.push({ itemId: item.id, title: item.title, why: "Lançamento pendente" });
    if (v == null) continue;
    if (item.recovery) { recoveryCell = { item, value: v }; continue; }
    considered.push({ itemId: item.id, title: item.title, value: v, weight: item.weight });
  }

  const totalWeight = considered.reduce((a, c) => a + c.weight, 0);
  const pendingCount = ignored.filter((i) => i.why.startsWith("Lançamento")).length;
  const partial = pendingCount > 0 || ignored.length > 0 || (opts.expectedItems != null && considered.length < opts.expectedItems);

  let raw: number | null = null;
  let formula = "";
  if (totalWeight > 0) {
    raw = considered.reduce((a, c) => a + c.value * c.weight, 0) / totalWeight;
    formula = considered.map((c) => `${fmt(c.value)} × ${fmt(c.weight / totalWeight)}`).join(" + ");
    formula = `${formula} = ${fmt(raw)}`;
  }

  let result = raw;
  const before: number | null = raw;
  let recoveryApplied = false;
  if (recoveryCell && raw != null && rules.recovery !== "none" && rules.recovery !== "independent") {
    if (rules.recovery === "replace_if_higher" && recoveryCell.value > raw) { result = recoveryCell.value; recoveryApplied = true; }
    if (rules.recovery === "average") { result = (raw + recoveryCell.value) / 2; recoveryApplied = true; }
    if (recoveryApplied) formula += ` → recuperação (${rules.recovery === "average" ? "média" : "maior nota"}) = ${fmt(result!)}`;
  }
  const average = result == null ? null : applyRounding(result, rules.rounding);
  return { partial, raw, average, considered, ignored, formula, before, recoveryApplied, totalWeight };
}

export function validateWeights(items: { weight: number }[]) {
  const total = items.reduce((a, i) => a + i.weight, 0);
  if (items.length === 0) return { ok: false, message: "Nenhuma atividade cadastrada no período." };
  if (items.some((i) => !(i.weight > 0))) return { ok: false, message: "Há atividade com peso inválido." };
  return { ok: true, message: total === 100 || Math.abs(total - 1) < 1e-9 ? "" : `Soma dos pesos: ${total}.` };
}

/** Converte texto de nota pt-BR ("7,5") ou estados ("F", "A", "N") em célula. */
export function parseGradeInput(raw: string, maxPoints: number): { state: GradeState; value: number | null } | { error: string } {
  const t = raw.trim();
  if (t === "") return { state: "pending", value: null };
  const up = t.toUpperCase();
  if (["F", "AUS", "AUSENTE"].includes(up)) return { state: "absent", value: null };
  if (["N", "ND", "NE", "SEM ENTREGA"].includes(up)) return { state: "not_delivered", value: null };
  if (["?", "P", "PENDENTE"].includes(up)) return { state: "pending", value: null };
  const norm = t.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return { error: `Valor “${raw}” inválido.` };
  const v = Number(norm);
  if (v < 0 || v > maxPoints) return { error: `Valor ${raw} fora da faixa 0–${String(maxPoints).replace(".", ",")}.` };
  if (v === 0) return { state: "zero", value: 0 };
  return { state: "value", value: v };
}

/** Situação do aluno no período: aprovado (média ≥ mínima), recuperação (até 2 pontos abaixo) ou reprovado. */
export function situation(average: number | null, passMark: number): "sem_notas" | "aprovado" | "recuperacao" | "reprovado" {
  if (average == null) return "sem_notas";
  if (average >= passMark) return "aprovado";
  return average >= passMark - 2 ? "recuperacao" : "reprovado";
}
