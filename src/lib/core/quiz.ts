/** Regras puras do quiz ao vivo (sem banco): pontuação, código de entrada e leitura do texto das perguntas. */
export type Pergunta = { texto: string; opcoes: string[]; certa: number; segundos: number };

/** 1000 pontos por resposta certa na hora; cai até 500 conforme o tempo se esgota. Errada ou fora do tempo: 0. */
export function pontosDaResposta(certa: boolean, ms: number, segundos: number): number {
  if (!certa) return 0;
  const total = segundos * 1000;
  if (ms < 0 || ms > total + 1500) return 0;
  const frac = Math.min(1, Math.max(0, ms / total));
  return Math.round(1000 - 500 * frac);
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1 para não confundir na lousa
export function gerarCodigo(rand: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  return Array.from({ length: 6 }, () => ALFABETO[rand(ALFABETO.length)]).join("");
}
export const normalizarCodigo = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export function normalizarApelido(s: string): string { return s.replace(/\s+/g, " ").trim().slice(0, 20); }

/**
 * Formato do professor (uma pergunta por bloco, separado por linha em branco):
 *   Quanto é 2+2?
 *   * 4
 *   - 3
 *   - 5
 * "*" marca a certa; "-" as erradas (2 a 4 opções). Opcional: "[20s]" no fim da pergunta define os segundos.
 */
export function lerPerguntas(texto: string): { perguntas: Pergunta[]; erros: string[] } {
  const perguntas: Pergunta[] = []; const erros: string[] = [];
  const blocos = texto.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  blocos.forEach((b, i) => {
    const linhas = b.split("\n").map((l) => l.trim()).filter(Boolean);
    const enun: string[] = []; const opcoes: string[] = []; let certa = -1;
    for (const l of linhas) {
      const m = /^([*-])\s+(.+)$/.exec(l);
      if (m) { if (m[1] === "*") { if (certa >= 0) { erros.push(`Pergunta ${i + 1}: mais de uma opção marcada como certa.`); certa = -2; } else if (certa === -1) certa = opcoes.length; } opcoes.push(m[2].slice(0, 120)); }
      else if (!opcoes.length) enun.push(l);
    }
    let seg = 20; let t = enun.join(" ").trim();
    const s = /\[(\d{1,3})\s*s\]\s*$/i.exec(t); if (s) { seg = Math.min(120, Math.max(5, Number(s[1]))); t = t.replace(s[0], "").trim(); }
    if (!t) { erros.push(`Pergunta ${i + 1}: falta o enunciado.`); return; }
    if (opcoes.length < 2 || opcoes.length > 4) { erros.push(`Pergunta ${i + 1}: use de 2 a 4 opções (linhas com * ou -).`); return; }
    if (certa < 0) { if (certa === -1) erros.push(`Pergunta ${i + 1}: marque a opção certa com *.`); return; }
    perguntas.push({ texto: t.slice(0, 300), opcoes, certa, segundos: seg });
  });
  return { perguntas: perguntas.slice(0, 30), erros };
}

export function perguntasParaTexto(ps: Pergunta[]): string {
  return ps.map((p) => `${p.texto}${p.segundos !== 20 ? ` [${p.segundos}s]` : ""}\n${p.opcoes.map((o, i) => `${i === p.certa ? "*" : "-"} ${o}`).join("\n")}`).join("\n\n");
}

export function ranking<T extends { id: string; score: number; nickname: string }>(jogadores: T[]) {
  return [...jogadores].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname, "pt-BR")).map((j, i) => ({ ...j, pos: i + 1 }));
}

/** Valida perguntas vindas do construtor ou da GizIA (formato estruturado). */
export function validarPerguntas(entrada: unknown): { perguntas: Pergunta[]; erros: string[] } {
  const perguntas: Pergunta[] = []; const erros: string[] = [];
  const lista = Array.isArray(entrada) ? entrada : [];
  lista.slice(0, 30).forEach((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const texto = String(r.texto ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    const opcoes = (Array.isArray(r.opcoes) ? r.opcoes : []).map((o) => String(o ?? "").replace(/\s+/g, " ").trim().slice(0, 120));
    const certa = Number(r.certa); const segundos = Math.min(120, Math.max(5, Math.round(Number(r.segundos) || 20)));
    if (!texto) { erros.push(`Pergunta ${i + 1}: escreva o enunciado.`); return; }
    if (opcoes.length < 2 || opcoes.length > 4) { erros.push(`Pergunta ${i + 1}: use de 2 a 4 opções.`); return; }
    if (opcoes.some((o) => !o)) { erros.push(`Pergunta ${i + 1}: há opção em branco.`); return; }
    if (!Number.isInteger(certa) || certa < 0 || certa >= opcoes.length) { erros.push(`Pergunta ${i + 1}: marque a opção certa.`); return; }
    perguntas.push({ texto, opcoes, certa, segundos });
  });
  return { perguntas, erros };
}
