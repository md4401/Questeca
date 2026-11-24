/** Busca do banco de questões: sem acento, por frase, por palavras e por assuntos relacionados (ex.: autor → obras e movimento). */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export type Entity = { id: string; label: string; names: string[]; related: string[] };
/** Conhecimento curado: o professor busca o autor ou tema e encontra questões que falam das obras e do contexto. */
export const ENTITIES: Entity[] = [
  { id: "machado", label: "Machado de Assis", names: ["machado de assis", "machado"], related: ["dom casmurro", "memorias postumas", "bras cubas", "quincas borba", "capitu", "bentinho", "escobar", "o alienista", "simao bacamarte", "missa do galo", "realismo", "humanitismo", "ao vencedor as batatas", "itaguai"] },
  { id: "clarice", label: "Clarice Lispector", names: ["clarice lispector", "clarice"], related: ["a hora da estrela", "macabea", "perto do coracao selvagem", "paixao segundo g h", "modernismo", "geracao de 45", "fluxo de consciencia"] },
  { id: "rosa", label: "Guimarães Rosa", names: ["guimaraes rosa", "joao guimaraes rosa"], related: ["grande sertao veredas", "riobaldo", "diadorim", "sagarana", "sertao", "regionalismo", "terceira geracao modernista"] },
  { id: "drummond", label: "Carlos Drummond de Andrade", names: ["carlos drummond de andrade", "drummond"], related: ["no meio do caminho", "sentimento do mundo", "a rosa do povo", "modernismo", "poesia", "pedra"] },
  { id: "alencar", label: "José de Alencar", names: ["jose de alencar", "alencar"], related: ["iracema", "o guarani", "senhora", "romantismo", "indianismo", "lucíola"] },
  { id: "graciliano", label: "Graciliano Ramos", names: ["graciliano ramos", "graciliano"], related: ["vidas secas", "fabiano", "sinha vitoria", "baleia", "sao bernardo", "regionalismo", "romance de 30"] },
  { id: "camoes", label: "Luís de Camões", names: ["luis de camoes", "camoes"], related: ["os lusiadas", "classicismo", "epopeia", "vasco da gama", "soneto"] },
  { id: "pessoa", label: "Fernando Pessoa", names: ["fernando pessoa"], related: ["alberto caeiro", "alvaro de campos", "ricardo reis", "heteronimo", "mensagem", "modernismo portugues"] },
  { id: "lima", label: "Lima Barreto", names: ["lima barreto"], related: ["triste fim de policarpo quaresma", "policarpo quaresma", "pre modernismo", "clara dos anjos"] },
  { id: "realismo", label: "Realismo", names: ["realismo", "naturalismo"], related: ["machado de assis", "eca de queiros", "aluisio azevedo", "o cortico", "analise psicologica", "critica social"] },
  { id: "modernismo", label: "Modernismo", names: ["modernismo", "semana de 22"], related: ["mario de andrade", "oswald de andrade", "manuel bandeira", "drummond", "macunaima", "antropofagia", "verso livre"] },
  { id: "revfr", label: "Revolução Francesa", names: ["revolucao francesa"], related: ["iluminismo", "1789", "bastilha", "robespierre", "napoleao", "liberdade igualdade fraternidade", "jacobinos"] },
  { id: "iluminismo", label: "Iluminismo", names: ["iluminismo"], related: ["voltaire", "rousseau", "montesquieu", "enciclopedia", "contrato social", "razao"] },
  { id: "fotossintese", label: "Fotossíntese", names: ["fotossintese"], related: ["clorofila", "cloroplasto", "glicose", "luz solar", "respiracao celular"] },
];

const STOP = new Set(["de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "no", "na", "um", "uma", "que", "sobre", "com", "para", "por"]);
const ENT = ENTITIES.map((e) => ({ ...e, namesN: e.names.map(norm), relatedN: e.related.map(norm) }));

export type Parsed = { raw: string; entities: typeof ENT; tokens: string[]; phrase: string };
export function parseQuery(q: string): Parsed {
  const phrase = norm(q);
  const entities = ENT.filter((e) => e.namesN.some((n) => phrase.includes(n)));
  const covered = entities.flatMap((e) => e.namesN.flatMap((n) => n.split(" ")));
  const tokens = phrase.split(" ").filter((t) => t && !STOP.has(t) && !covered.includes(t));
  return { raw: q, entities, tokens, phrase };
}

export type Doc = { title: string; statement: string | null; alternatives?: { text: string }[]; institution: string; exam: string; year: number; extra?: string };
export type Match = { score: number; reasons: { kind: "cita" | "relacionada" | "palavra"; text: string }[]; terms: string[] };

const has = (hay: string, needle: string) => needle.length > 1 && (` ${hay} `).includes(` ${needle} `) ;
export function scoreDoc(d: Doc, p: Parsed): Match {
  const title = norm(d.title);
  const body = norm(`${d.statement ?? ""} ${(d.alternatives ?? []).map((a) => a.text).join(" ")}`);
  const meta = norm(`${d.institution} ${d.exam} ${d.year} ${d.extra ?? ""}`);
  const all = `${title} ${body} ${meta}`;
  let score = 0; const reasons: Match["reasons"] = []; const terms: string[] = [];
  for (const e of p.entities) {
    const direct = e.namesN.find((n) => has(all, n));
    if (direct) { score += title.includes(direct) ? 14 : 10; reasons.push({ kind: "cita", text: e.label }); terms.push(direct); }
    for (let i = 0; i < e.relatedN.length; i++) {
      const r = e.relatedN[i];
      if (has(all, r)) { score += 3; reasons.push({ kind: "relacionada", text: e.related[i] }); terms.push(r); }
    }
  }
  for (const t of p.tokens) {
    if (has(title, t)) { score += 4; terms.push(t); reasons.push({ kind: "palavra", text: t }); }
    else if (has(body, t) || has(meta, t)) { score += 2; terms.push(t); reasons.push({ kind: "palavra", text: t }); }
    else if (t.length > 4 && all.includes(t)) { score += 1; terms.push(t); } // prefixo/plural
  }
  // todos os termos digitados precisam aparecer (sem entidade reconhecida) — evita ruído
  if (!p.entities.length && p.tokens.length && !p.tokens.every((t) => all.includes(t))) return { score: 0, reasons: [], terms: [] };
  return { score, reasons: dedupe(reasons).slice(0, 6), terms: [...new Set(terms)] };
}
const dedupe = (r: Match["reasons"]) => r.filter((x, i) => r.findIndex((y) => y.kind === x.kind && y.text === x.text) === i);

/** Divide o texto em trechos, marcando os que contêm algum termo (comparando sem acento). */
export function highlight(text: string, terms: string[]): { t: string; hit: boolean }[] {
  if (!terms.length || !text) return [{ t: text, hit: false }];
  const out: { t: string; hit: boolean }[] = [];
  const words = text.match(/[A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9]+/g) ?? [text];
  // junta palavras para casar termos de várias palavras
  const nw = words.map((w) => norm(w));
  let i = 0;
  const multi = terms.filter((t) => t.includes(" ")).sort((a, b) => b.split(" ").length - a.split(" ").length);
  while (i < words.length) {
    let matched = 0;
    for (const m of multi) {
      const n = m.split(" ").length; const win = words.slice(i, i + n * 2 - 1); const slice = win.filter((w) => /[A-Za-zÀ-ÿ0-9]/.test(w));
      if (slice.length === n && /[A-Za-zÀ-ÿ0-9]/.test(words[i]) && norm(slice.join(" ")) === m) { matched = win.length; break; }
    }
    if (!matched && nw[i] && terms.some((t) => !t.includes(" ") && nw[i] === t)) matched = 1;
    if (matched) { out.push({ t: words.slice(i, i + matched).join(""), hit: true }); i += matched; }
    else { const last = out[out.length - 1]; if (last && !last.hit) last.t += words[i]; else out.push({ t: words[i], hit: false }); i++; }
  }
  return out;
}

/** Texto de busca de uma questão (título, enunciado, alternativas, banca, prova, ano), já normalizado. */
export function searchNormOf(q: { title: string; statement?: string | null; alternatives?: { text: string }[] | null; institution: string; exam: string; year: number; extra?: string }): string {
  return norm(`${q.title} ${q.statement ?? ""} ${(q.alternatives ?? []).map((a) => a.text).join(" ")} ${q.institution} ${q.exam} ${q.year} ${q.extra ?? ""}`);
}
