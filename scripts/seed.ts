import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import { questions } from "../src/db/schema";
import { SEED, LIT_SEED, REFERENCE_ONLY } from "../src/db/seed-questions";
import { searchNormOf } from "../src/lib/core/search";
import { classificar } from "../src/lib/core/classificacao";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
else if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${new URL(url).host}/sql`;
const db = drizzle(neon(url));

let inserted = 0;
for (const q of [...SEED, ...LIT_SEED]) {
  const [exists] = await db.select({ id: questions.id }).from(questions).where(and(eq(questions.title, q.t), eq(questions.institution, "Segunda Lousa"))).limit(1);
  if (exists) continue;
  const cl = classificar({ subject: q.subject ?? "matematica", title: q.t, statement: q.s, alternatives: q.alts.map((t: string) => ({ text: t })) });
  await db.insert(questions).values({
    tema: cl.tema, series: cl.series,
    subject: q.subject ?? "matematica", institution: "Segunda Lousa", exam: "Banco autoral Segunda Lousa (exemplo)", year: 2026, title: q.t, statement: q.s,
    alternatives: ["A", "B", "C", "D", "E"].map((k, i) => ({ key: k, text: q.alts[i] })),
    answer: q.a, answerSource: "Gabarito autoral conferido pela equipe Segunda Lousa", status: "released",
    licenseNote: "Questão autoral da Segunda Lousa, de uso liberado na plataforma.",
    assessed: q.topics, prerequisites: q.pre ?? [], methods: q.methods ?? [], difficulty: q.d, estSeconds: q.sec,
    searchNorm: searchNormOf({ title: q.t, statement: q.s, alternatives: ["A", "B", "C", "D", "E"].map((_, i) => ({ text: q.alts[i] })), institution: "Segunda Lousa", exam: "Banco autoral Segunda Lousa (exemplo)", year: 2026, extra: cl.tema }),
    stimulusId: q.stim ?? null, isDemo: true, reviewedBy: "Equipe Segunda Lousa", reviewedAt: new Date(),
  });
  inserted++;
}
for (const r of REFERENCE_ONLY) {
  const [exists] = await db.select({ id: questions.id }).from(questions).where(and(eq(questions.title, r.title), eq(questions.institution, r.institution))).limit(1);
  if (exists) continue;
  await db.insert(questions).values({ ...r, searchNorm: searchNormOf({ title: r.title, institution: r.institution, exam: r.exam, year: r.year }), status: "reference_only", statement: null, alternatives: [], prerequisites: [], methods: [], difficulty: 3, estSeconds: 180, isDemo: false });
  inserted++;
}
console.log(`acervo: ${inserted} itens inseridos`);
