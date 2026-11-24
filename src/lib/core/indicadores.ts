/** Atividade pendente = atividade de notas (grade_items) em que ainda falta lançar a nota de algum aluno ativo da turma. */
export function atividadesPendentes(itens: { id: string; classId: string }[], ativosPorTurma: Map<string, number>, lancadasPorItem: Map<string, number>) {
  return itens.filter((i) => (lancadasPorItem.get(i.id) ?? 0) < (ativosPorTurma.get(i.classId) ?? 0)).length;
}
