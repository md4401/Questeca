/** Atividade pendente = atividade de notas (grade_items) em que ainda falta lançar a nota de algum aluno ativo da turma. */
export function atividadesPendentes(itens: { id: string; classId: string }[], ativosPorTurma: Map<string, number>, lancadasPorItem: Map<string, number>) {
  return itens.filter((i) => (lancadasPorItem.get(i.id) ?? 0) < (ativosPorTurma.get(i.classId) ?? 0)).length;
}

/** Contagem por semana (segunda a domingo) nas últimas `n` semanas, da mais antiga para a mais recente. */
export function semanasRecentes(datas: Date[], hoje: Date, n = 8): number[] {
  const dia = 864e5;
  const seg = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const w = (x.getUTCDay() + 6) % 7; return x.getTime() - w * dia; };
  const fimAtual = seg(hoje);
  const out = new Array<number>(n).fill(0);
  for (const d of datas) { const k = Math.round((fimAtual - seg(d)) / (7 * dia)); if (k >= 0 && k < n) out[n - 1 - k]++; }
  return out;
}

/** Total acumulado ao fim de cada um dos últimos `n` meses (inclui o que veio antes da janela). */
export function acumuladoMensal(datas: Date[], hoje: Date, n = 6): number[] {
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const limite = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i + 1, 1); // 1º dia do mês seguinte
    out.push(datas.filter((d) => d.getTime() < limite).length);
  }
  return out;
}

export const mediaDe = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

/** Texto do cartão de desempenho conforme a média geral (0–10) e a nota de aprovação da escola. */
export function mensagemDesempenho(media: number | null, passMark = 6): { titulo: string; apoio: string; tom: "ok" | "atencao" | "risco" | "vazio" } {
  if (media == null) return { titulo: "Ainda sem notas lançadas.", apoio: "Lance as primeiras notas para acompanhar o desempenho.", tom: "vazio" };
  if (media >= Math.max(7, passMark + 1)) return { titulo: "Sua turma está com um bom desempenho!", apoio: "Continue assim.", tom: "ok" };
  if (media >= passMark) return { titulo: "Desempenho dentro do esperado.", apoio: "Vale olhar as atividades com média mais baixa.", tom: "atencao" };
  return { titulo: "A média geral está abaixo do esperado.", apoio: "Veja os alunos em risco e retome os conteúdos.", tom: "risco" };
}
