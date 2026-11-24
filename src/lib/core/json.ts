/** Extrai o primeiro objeto JSON balanceado do texto (o modelo pode escrever algo antes/depois). */
export function extrairJson(t: string): Record<string, unknown> | null {
  const i = t.indexOf("{");
  if (i < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = i; k < t.length; k++) {
    const c = t[k];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) { try { return JSON.parse(t.slice(i, k + 1)); } catch { return null; } }
  }
  return null;
}


/** Interpreta a resposta do modelo: chamada de ferramenta, texto final ou formato inválido. Tolera variações de campo ("acao":"gerar_prova", "tool", "resposta"…). */
export function interpretarResposta(j: Record<string, unknown>, ferramentas: string[]): { tipo: "ferramenta"; nome: string; args: unknown } | { tipo: "texto"; texto: string } | { tipo: "invalida" } {
  const nome = [j.nome, j.ferramenta, j.tool, j.acao].find((x): x is string => typeof x === "string" && ferramentas.includes(x));
  if (nome) return { tipo: "ferramenta", nome, args: j.args ?? j.argumentos ?? j.parametros ?? {} };
  const texto = [j.texto, j.resposta, j.reply, j.mensagem].find((x): x is string => typeof x === "string" && x.trim().length > 0);
  return texto ? { tipo: "texto", texto } : { tipo: "invalida" };
}
