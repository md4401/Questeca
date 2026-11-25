/**
 * Anexa às questões as figuras recortadas dos PDFs (scripts/figuras/extrair_figuras.py) e, com --liberar,
 * libera as que estavam em curadoria só por depender de figura.
 * Uso: pnpm db:importar-figuras <pasta-das-figuras>... [--questoes data/questoes-extraidas] [--liberar]
 *   cada pasta tem manifesto.jsonl + os .png. Idempotente (troca as figuras da questão).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, inArray } from "drizzle-orm";
import { questions, questionImages } from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
else if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${new URL(url).host}/sql`;
const db = drizzle(neon(url));

const args = process.argv.slice(2);
const liberar = args.includes("--liberar");
const qi = args.indexOf("--questoes");
const pastaQuestoes = qi >= 0 ? args[qi + 1] : null;
const pastas = args.filter((a, i) => !a.startsWith("--") && i !== qi + 1 && existsSync(a) && statSync(a).isDirectory());
if (!pastas.length) throw new Error("Informe as pastas de figuras.");

const NOMES: Record<string, string> = { fuvest: "Fuvest", uerj: "Uerj", comvest: "Comvest", "puc-sp": "PUC-SP", espm: "ESPM", mackenzie: "Mackenzie", vunesp: "Vunesp", ufpr: "UFPR", pas: "PAS/UnB", ita: "ITA", "puc-campinas": "PUC-Campinas", upe: "UPE", ufpel: "UFPel (PAVE)", unicentro: "Unicentro", etec: "Etec", ifrs: "IFRS", obm: "OBM", obmep: "OBMEP", ufg: "UFG", unifesp: "Unifesp", ufscar: "UFSCar" };
const banca = (s: string) => NOMES[String(s).toLowerCase()] ?? s;
const key = (i: string, e: string, y: number, ph: string | null, n: number) => `${i}|${e}|${y}|${ph ?? ""}|${n}`;

const ids = new Map<string, string>();
for (const r of await db.select({ id: questions.id, i: questions.institution, e: questions.exam, y: questions.year, p: questions.phase, n: questions.number }).from(questions)) if (r.n != null) ids.set(key(r.i, r.e, r.y, r.p, r.n), r.id);

let anexadas = 0, semQuestao = 0, imagens = 0; const comImagem = new Set<string>();
for (const dir of pastas) {
  const man = join(dir, "manifesto.jsonl");
  if (!existsSync(man)) continue;
  for (const l of readFileSync(man, "utf8").split("\n")) {
    if (!l.trim()) continue;
    const m = JSON.parse(l) as { instituicao: string; exam: string; ano: number; fase: string | null; numero: number; imagens: { arquivo: string; w: number; h: number }[] };
    const qid = ids.get(key(banca(m.instituicao), m.exam, m.ano, m.fase ?? null, m.numero));
    if (!qid) { semQuestao++; continue; }
    await db.delete(questionImages).where(eq(questionImages.questionId, qid));
    await db.insert(questionImages).values(m.imagens.map((im, k) => ({ questionId: qid, position: k, mime: "image/png", width: im.w, height: im.h, data: readFileSync(join(dir, im.arquivo)) })));
    anexadas++; imagens += m.imagens.length; comImagem.add(qid);
  }
}
console.log(`Questões com figura anexada: ${anexadas} (${imagens} imagens) · sem questão correspondente: ${semQuestao}`);

if (liberar) {
  if (!pastaQuestoes) throw new Error("--liberar exige --questoes <pasta dos .jsonl>");
  const OK_FIG = /figura|gr[áa]fico|tabela|imagem|mapa|legenda|visual|charge|tirinha/i;
  const RUIM = /texto|numera|contagem|lacuna|n[aã]o casad|sem gabarito|colun|truncad|incomplet|ileg[ií]vel|anulad/i;
  const elegiveis = new Set<string>();
  for (const f of readdirSync(pastaQuestoes).filter((f) => f.endsWith(".jsonl")))
    for (const l of readFileSync(join(pastaQuestoes, f), "utf8").split("\n")) {
      if (!l.trim()) continue;
      const r = JSON.parse(l);
      if (r.tem_figura && r.gabarito && /^[A-E]$/.test(r.gabarito) && (r.alternativas ?? []).length >= 2 && r.enunciado && OK_FIG.test(r.notas ?? "") && !RUIM.test(r.notas ?? ""))
        elegiveis.add(key(banca(r.instituicao), r.exam, r.ano, r.fase ?? null, r.numero));
    }
  const alvo = [...elegiveis].map((k) => ids.get(k)).filter((x): x is string => !!x && comImagem.has(x));
  let n = 0;
  for (let i = 0; i < alvo.length; i += 200) {
    const r = await db.update(questions).set({ status: "released", reviewedBy: "extracao-automatica-figura", reviewedAt: new Date() }).where(and(inArray(questions.id, alvo.slice(i, i + 200)), eq(questions.status, "curation"), eq(questions.voided, false))).returning({ id: questions.id });
    n += r.length;
  }
  console.log(`Liberadas por terem figura anexada: ${n} de ${alvo.length} elegíveis`);
}
process.exit(0);
