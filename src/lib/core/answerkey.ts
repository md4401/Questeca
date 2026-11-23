export type Rubric = { name: string; points: number }[];
export type ParsedKey = { key: string[]; points: number[]; rubrics: Record<number, Rubric> } | { error: string };

/** Gabarito externo: "A,C,B,D(Conclusão=1;Justificativa=2),E". Discursivas usam critérios observáveis com pontos explícitos. */
export function parseAnswerKey(input: string, total: number): ParsedKey {
  const tokens: string[] = [];
  let depth = 0; let cur = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if ((ch === "," || ch === ";" || ch === "\n") && depth === 0) { if (cur.trim()) tokens.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());
  if (!tokens.length) return { error: "Informe o gabarito (ex.: A,C,B,E)." };
  const key: string[] = []; const rubrics: Record<number, Rubric> = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^[A-Ea-e]$/.test(t)) { key.push(t.toUpperCase()); continue; }
    const m = t.match(/^[Dd]\((.+)\)$/);
    if (m) {
      const crit: Rubric = [];
      for (const part of m[1].split(";")) {
        const [name, pts] = part.split("=");
        const v = Number((pts ?? "").replace(",", "."));
        if (!name?.trim() || !isFinite(v) || v <= 0) return { error: `Critério inválido em “${t}”. Use D(Critério=pontos;Outro=pontos).` };
        crit.push({ name: name.trim(), points: v });
      }
      key.push("*"); rubrics[i] = crit; continue;
    }
    return { error: `Item ${i + 1}: “${t}” inválido. Use A–E ou D(Critério=pontos).` };
  }
  const dSum = Object.values(rubrics).reduce((s, r) => s + r.reduce((a, c) => a + c.points, 0), 0);
  const nObj = key.filter((k) => k !== "*").length;
  if (dSum > total + 1e-9) return { error: "A soma dos critérios das discursivas excede o total da prova." };
  const each = nObj ? Math.floor(((total - dSum) / nObj) * 100) / 100 : 0;
  const points = key.map((k, i) => (k === "*" ? rubrics[i].reduce((a, c) => a + c.points, 0) : each));
  return { key, points, rubrics };
}

export type ScoreInput = { key: string; points: number; value: string | null; status: string };

/** Pontuação de uma resposta objetiva; discursivas usam o valor numérico lançado pelo professor. */
export function scoreResponse(i: ScoreInput): { points: number | null; status: "answered" | "blank" | "pending" } {
  if (i.status === "pending") return { points: null, status: "pending" };
  if (i.key === "*") {
    if (i.value == null || i.value === "") return { points: null, status: "pending" };
    const v = Number(String(i.value).replace(",", "."));
    if (!isFinite(v) || v < 0) return { points: null, status: "pending" };
    return { points: Math.min(v, i.points), status: "answered" };
  }
  if (i.value == null || i.value === "" || i.value === "-") return { points: 0, status: "blank" };
  return { points: i.value.toUpperCase() === i.key ? i.points : 0, status: "answered" };
}

export function normalizeResponse(raw: string, key: string): { value: string; error?: string } {
  const t = raw.trim().toUpperCase().replace(",", ".");
  if (key === "*") {
    if (t === "") return { value: "" };
    if (!/^\d+(\.\d+)?$/.test(t)) return { value: "", error: "Informe a pontuação numérica." };
    return { value: t };
  }
  if (t === "" || t === "-" || t === "X") return { value: "-" };
  if (!/^[A-E]$/.test(t)) return { value: "", error: "Use A–E ou - para em branco." };
  return { value: t };
}
