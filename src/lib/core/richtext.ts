/**
 * Texto formatado das provas editadas. Guardamos marcação simples e segura: {b}negrito{/b} {i}itálico{/i} {u}sublinhado{/u}, quebra de linha = \n.
 * O editor (navegador) converte HTML ⇄ marcação; PDF, Word e prévia leem a marcação. Nada de HTML livre no banco.
 */
export type Run = { t: string; b?: boolean; i?: boolean; u?: boolean };

const same = (a: Run, b: Run) => !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u;
function merge(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) { if (!r.t) continue; const l = out[out.length - 1]; if (l && same(l, r)) l.t += r.t; else out.push({ ...r }); }
  return out;
}
const esc = (t: string) => t.replace(/\{/g, "{lb}");
function serialize(runs: Run[]): string {
  return merge(runs).map((r) => {
    let s = esc(r.t).replace(/\n/g, "\n");
    // marcações não atravessam quebras de linha: fecham e reabrem em cada linha
    s = s.split("\n").map((ln) => (ln ? `${r.b ? "{b}" : ""}${r.i ? "{i}" : ""}${r.u ? "{u}" : ""}${ln}${r.u ? "{/u}" : ""}${r.i ? "{/i}" : ""}${r.b ? "{/b}" : ""}` : "")).join("\n");
    return s;
  }).join("");
}
const clampNl = (s: string) => s.replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");

/** Marcação → linhas de trechos. */
export function parseMarkup(m: string): Run[][] {
  const lines: Run[][] = [[]];
  let b = false, i = false, u = false;
  for (const tok of (m ?? "").split(/(\{\/?[biu]\}|\{lb\}|\n)/)) {
    if (!tok) continue;
    if (tok === "{b}") b = true; else if (tok === "{/b}") b = false;
    else if (tok === "{i}") i = true; else if (tok === "{/i}") i = false;
    else if (tok === "{u}") u = true; else if (tok === "{/u}") u = false;
    else if (tok === "\n") lines.push([]);
    else lines[lines.length - 1].push({ t: tok === "{lb}" ? "{" : tok, b, i, u });
  }
  return lines;
}
/** Normaliza qualquer marcação (descarta tags desconhecidas, equilibra as abertas). */
export function normalizeMarkup(m: string): string { return clampNl(serialize(parseMarkup(m).flatMap((ln, k, all) => [...ln, ...(k < all.length - 1 ? [{ t: "\n" }] : [])]))); }
export const plain = (m: string) => parseMarkup(m).map((ln) => ln.map((r) => r.t).join("")).join("\n");

const entities: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };
const decode = (s: string) => s.replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (x) => entities[x] ?? x);
const BLOCK = /^(div|p|li|h[1-6]|tr)$/;

/** HTML do editor → marcação segura. */
export function fromHtml(html: string): string {
  const runs: Run[] = [];
  let b = 0, i = 0, u = 0;
  const nl = () => { const l = runs[runs.length - 1]; if (!l || l.t !== "\n") runs.push({ t: "\n" }); };
  for (const tok of html.match(/<\/?[a-zA-Z][^>]*>|[^<]+|</g) ?? []) {
    const tag = /^<(\/?)([a-zA-Z0-9]+)([^>]*)>$/.exec(tok);
    if (!tag) { const t = decode(tok.replace(/\r?\n/g, " ")); if (t) runs.push({ t, b: b > 0, i: i > 0, u: u > 0 }); continue; }
    const close = tag[1] === "/"; const name = tag[2].toLowerCase(); const attrs = tag[3].toLowerCase();
    const d = close ? -1 : 1;
    if (name === "b" || name === "strong") b = Math.max(0, b + d);
    else if (name === "i" || name === "em") i = Math.max(0, i + d);
    else if (name === "u") u = Math.max(0, u + d);
    else if (name === "span" && !close) { /* estilos de negrito/itálico/sublinhado em <span> (alguns navegadores) são tratados abaixo */ if (/font-weight:\s*(bold|[6-9]00)/.test(attrs)) b++; if (/font-style:\s*italic/.test(attrs)) i++; if (/underline/.test(attrs)) u++; stack.push({ b: /font-weight:\s*(bold|[6-9]00)/.test(attrs), i: /font-style:\s*italic/.test(attrs), u: /underline/.test(attrs) }); continue; }
    else if (name === "span" && close) { const s = stack.pop(); if (s) { if (s.b) b = Math.max(0, b - 1); if (s.i) i = Math.max(0, i - 1); if (s.u) u = Math.max(0, u - 1); } continue; }
    else if (name === "br") runs.push({ t: "\n" });
    else if (BLOCK.test(name)) { if (runs.length) nl(); }
  }
  return clampNl(serialize(runs));
}
const stack: { b: boolean; i: boolean; u: boolean }[] = [];

const h = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Marcação → HTML para o editor e a prévia. */
export function toHtml(m: string): string {
  return parseMarkup(m).map((ln) => ln.map((r) => { let s = h(r.t); if (r.u) s = `<u>${s}</u>`; if (r.i) s = `<i>${s}</i>`; if (r.b) s = `<b>${s}</b>`; return s; }).join("")).join("<br>");
}
