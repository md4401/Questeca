/**
 * Audita o banco de questões: acha problemas de extração nas liberadas (cabeçalho de página misturado, glifos quebrados,
 * enunciados gigantes/curtos, alternativas repetidas, gabarito inválido) e duplicatas.
 * Uso: pnpm db:auditar            → só relatório
 *      pnpm db:auditar --aplicar  → devolve as com problema (e as duplicatas) para "curation"
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, inArray } from "drizzle-orm";
import { questions } from "../src/db/schema";
import { problemasDaQuestao, impressaoDigital } from "../src/lib/core/qualidade";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
else if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${new URL(url).host}/sql`;
const db = drizzle(neon(url));
const aplicar = process.argv.includes("--aplicar");

const rows = await db.select({ id: questions.id, statement: questions.statement, alternatives: questions.alternatives, answer: questions.answer, origin: questions.origin, institution: questions.institution, year: questions.year, number: questions.number })
  .from(questions).where(and(eq(questions.status, "released"), eq(questions.voided, false)));
const ruins = new Map<string, string[]>(); const porMotivo: Record<string, number> = {};
for (const r of rows) {
  const p = problemasDaQuestao(r);
  if (p.length) { ruins.set(r.id, p); for (const m of p) porMotivo[m] = (porMotivo[m] ?? 0) + 1; }
}
const vistos = new Map<string, string>(); const dups: string[] = [];
for (const r of rows.filter((x) => !ruins.has(x.id) && (!x.origin || x.origin === "banco")).sort((a, b) => b.year - a.year)) {
  const k = impressaoDigital(r);
  if (vistos.has(k)) dups.push(r.id); else vistos.set(k, r.id);
}
console.log(`Liberadas: ${rows.length}`);
console.log(`Com problema: ${ruins.size}`, porMotivo);
console.log(`Duplicatas: ${dups.length}`);
if (aplicar) {
  const ids = [...ruins.keys(), ...dups];
  for (let i = 0; i < ids.length; i += 200) await db.update(questions).set({ status: "curation", reviewedBy: "auditoria-automatica", reviewedAt: new Date() }).where(inArray(questions.id, ids.slice(i, i + 200)));
  console.log(`Devolvidas para curadoria: ${ids.length}`);
} else console.log("Rode com --aplicar para devolvê-las para curadoria.");
process.exit(0);
