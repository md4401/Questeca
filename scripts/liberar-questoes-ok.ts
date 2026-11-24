/** Libera (status "released") as questões extraídas marcadas qualidade "ok", com gabarito e alternativas. Uso: pnpm exec tsx scripts/liberar-questoes-ok.ts <pasta> */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { questions } from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
else if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${new URL(url).host}/sql`;
const db = drizzle(neon(url));

const dir = process.argv[2];
if (!dir) throw new Error("Informe a pasta dos .jsonl");
const NOMES: Record<string, string> = { fuvest: "Fuvest", uerj: "Uerj", comvest: "Comvest", "puc-sp": "PUC-SP", espm: "ESPM", mackenzie: "Mackenzie", vunesp: "Vunesp", ufpr: "UFPR", pas: "PAS/UnB", ita: "ITA", "puc-campinas": "PUC-Campinas", upe: "UPE", ufpel: "UFPel (PAVE)", unicentro: "Unicentro", etec: "Etec", ifrs: "IFRS", obm: "OBM", obmep: "OBMEP", ufg: "UFG", unifesp: "Unifesp", ufscar: "UFSCar" };
const alvo: { i: string; e: string; y: number; n: number; ph: string | null; a: string }[] = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith(".jsonl")))
  for (const l of readFileSync(join(dir, f), "utf8").split("\n")) {
    if (!l.trim()) continue;
    const r = JSON.parse(l);
    if (r.qualidade === "ok" && r.gabarito && /^[A-E]$/.test(r.gabarito) && (r.alternativas ?? []).length >= 2 && r.enunciado)
      alvo.push({ i: NOMES[String(r.instituicao).toLowerCase()] ?? r.instituicao, e: r.exam, y: r.ano, n: r.numero, ph: r.fase ?? null, a: r.gabarito });
  }
let n = 0;
for (const t of alvo) {
  const res = await db.update(questions).set({ status: "released", answer: t.a, reviewedBy: "extracao-automatica-ok", reviewedAt: new Date(), licenseNote: "Prova oficial pública; extração automática marcada ok e liberada por decisão do responsável." })
    .where(and(eq(questions.institution, t.i), eq(questions.exam, t.e), eq(questions.year, t.y), eq(questions.number, t.n), t.ph ? eq(questions.phase, t.ph) : isNull(questions.phase), eq(questions.status, "curation"))).returning({ id: questions.id });
  n += res.length;
}
console.log(`Candidatas: ${alvo.length} · liberadas: ${n}`);
