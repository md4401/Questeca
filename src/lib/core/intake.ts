export type MsgIntake = { role: "user" | "assistant"; content: string; isError?: boolean };

const SEM_PERGUNTAS = /sem perguntas|n[aã]o (precisa|quero|preciso)( de)? (perguntas|perguntar)|pode criar (direto|logo|agora)|crie (direto|logo)|n[aã]o pergunte/i;

/**
 * Trava de criação: a GizIA só cria prova, plano de aula ou apresentação depois de entrevistar o professor.
 * Vale quando (a) já houve ao menos uma resposta da GizIA com perguntas nesta conversa, e (b) a chamada vem com confirmado=true,
 * ou quando o professor pede expressamente para não perguntar.
 */
export function podeCriar(historico: MsgIntake[], confirmado: unknown): { ok: true } | { ok: false; motivo: string } {
  const ultima = [...historico].reverse().find((m) => m.role === "user");
  if (ultima && SEM_PERGUNTAS.test(ultima.content)) return { ok: true };
  const anteriores = historico.slice(0, historico.lastIndexOf(ultima as MsgIntake));
  const perguntou = anteriores.some((m) => m.role === "assistant" && !m.isError && /\?/.test(m.content));
  if (!perguntou) return { ok: false, motivo: "Você ainda não entrevistou o professor. NÃO crie agora: responda (acao=responder) com a lista numerada de perguntas do protocolo e espere as respostas." };
  if (confirmado !== true) return { ok: false, motivo: "Falta confirmado=true. Só use confirmado=true quando o professor já respondeu às perguntas; se ainda faltam dados essenciais, pergunte de novo." };
  return { ok: true };
}
