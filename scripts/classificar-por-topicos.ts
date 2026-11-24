/**
 * Dá um tema às questões marcadas "Geral" usando o mapa de tópicos escolares (src/lib/core/topicos.ts).
 * Escolhe o tópico com maior pontuação no enunciado; sem pontuação mínima, deixa "Geral".
 * Uso: pnpm db:classificar-topicos [--aplicar]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import { questions } from "../src/db/schema";
import { TOPICOS } from "../src/lib/core/topicos";
import { parseQuery, scoreDoc } from "../src/lib/core/search";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
else if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${new URL(url).host}/sql`;
const db = drizzle(neon(url));
const aplicar = process.argv.includes("--aplicar");

const consultas = TOPICOS.map((t) => ({ label: t.label, p: parseQuery(t.names[0]) }));
const rows = await db.select().from(questions).where(and(eq(questions.status, "released"), eq(questions.tema, "Geral")));
let mudou = 0; const cont: Record<string, number> = {};
for (const q of rows) {
  const doc = { title: q.title, statement: q.statement, alternatives: q.alternatives, institution: q.institution, exam: q.exam, year: q.year };
  let melhor = { label: "", score: 0 };
  for (const c of consultas) { const s = scoreDoc(doc, c.p).score; if (s > melhor.score) melhor = { label: c.label, score: s }; }
  if (melhor.score >= 12) {
    mudou++; cont[melhor.label] = (cont[melhor.label] ?? 0) + 1;
    if (aplicar) await db.update(questions).set({ tema: melhor.label }).where(eq(questions.id, q.id));
  }
}
console.log(`"Geral": ${rows.length} · receberam tema: ${mudou}${aplicar ? " (aplicado)" : " (simulação; use --aplicar)"}`);
console.log(Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 12));
process.exit(0);
