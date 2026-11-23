export type AItem = { position: number; key: string; points: number; topics: string[] };
export type AResp = { studentId: string; position: number; value: string | null; status: string };

export function analyze(items: AItem[], resp: AResp[], absent: number, totalStudents: number) {
  const byStudent = new Map<string, AResp[]>();
  for (const r of resp) (byStudent.get(r.studentId) ?? byStudent.set(r.studentId, []).get(r.studentId)!).push(r);
  const complete = new Set([...byStudent].filter(([, rs]) => items.every((it) => rs.some((r) => r.position === it.position && r.status !== "pending"))).map(([id]) => id));
  const valid = complete.size;
  const pending = Math.max(0, totalStudents - absent - valid);
  const itemStats = items.map((it) => {
    const dist: Record<string, number> = {}; let correct = 0; let wrong = 0; let blank = 0; let n = 0;
    for (const r of resp) {
      if (r.position !== it.position || !complete.has(r.studentId)) continue;
      n++;
      const v = (r.value ?? "-").toUpperCase();
      if (it.key === "*") { if (Number(v.replace(",", ".")) >= it.points) correct++; else if (v === "-" || v === "") blank++; else wrong++; continue; }
      dist[v] = (dist[v] ?? 0) + 1;
      if (v === "-" || v === "") blank++; else if (v === it.key) correct++; else wrong++;
    }
    return { ...it, correct, wrong, blank, n, rate: n ? correct / n : 0, dist };
  });
  const tmap = new Map<string, { correct: number; n: number; items: number }>();
  for (const it of itemStats) for (const t of it.topics) {
    const cur = tmap.get(t) ?? { correct: 0, n: 0, items: 0 };
    cur.correct += it.correct; cur.n += it.n; cur.items += 1; tmap.set(t, cur);
  }
  const topics = [...tmap].map(([slug, v]) => ({ slug, items: v.items, n: v.n, rate: v.n ? v.correct / v.n : 0 })).sort((a, b) => a.rate - b.rate);
  return { valid, absent, pending, smallSample: valid > 0 && valid < 10, items: itemStats, topics, attention: topics.filter((t) => t.rate < 0.6 && t.n > 0) };
}

/**
 * Grupos de apoio sugeridos (temporários e revisáveis): para cada conteúdo com baixo acerto, os alunos que erraram
 * a maioria dos itens daquele conteúdo. Só considera alunos com leitura completa.
 */
export function supportGroups(items: AItem[], resp: AResp[], names: Map<string, string>, opts: { threshold?: number } = {}) {
  const thr = opts.threshold ?? 0.6;
  const byStudent = new Map<string, AResp[]>();
  for (const r of resp) (byStudent.get(r.studentId) ?? byStudent.set(r.studentId, []).get(r.studentId)!).push(r);
  const complete = [...byStudent].filter(([, rs]) => items.every((it) => rs.some((r) => r.position === it.position && r.status !== "pending"))).map(([id]) => id);
  const topics = new Set(items.flatMap((i) => i.topics));
  const groups: { topic: string; students: string[]; rate: number; n: number }[] = [];
  for (const t of topics) {
    const its = items.filter((i) => i.topics.includes(t));
    let correct = 0; let total = 0; const missers: string[] = [];
    for (const sid of complete) {
      let c = 0;
      for (const it of its) {
        const r = byStudent.get(sid)!.find((x) => x.position === it.position);
        const ok = r && it.key !== "*" ? (r.value ?? "").toUpperCase() === it.key : false;
        if (ok) c++;
      }
      correct += c; total += its.length;
      if (c / its.length < 0.5) missers.push(names.get(sid) ?? sid);
    }
    if (total && correct / total < thr && missers.length) groups.push({ topic: t, students: missers.sort(), rate: correct / total, n: total });
  }
  return groups.sort((a, b) => a.rate - b.rate);
}
