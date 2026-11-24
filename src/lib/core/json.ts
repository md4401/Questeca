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

