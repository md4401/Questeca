/**
 * Cria (ou reaproveita) uma conta de demonstração já verificada, com turma, alunos, atividades, notas e chamadas.
 * Uso: pnpm db:demo   (usa DATABASE_URL do .env.local)  ·  e-mail e senha opcionais: DEMO_EMAIL / DEMO_PASSWORD
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as S from "../src/db/schema";
import { hashPassword } from "../src/lib/crypto";
import { TERMS_VERSION } from "../src/lib/env";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
else if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${new URL(url).host}/sql`;
const db = drizzle(neon(url), { schema: S });

const EMAIL = (process.env.DEMO_EMAIL ?? "professor.demo@questeca.dev").toLowerCase();
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo12345";

const [exists] = await db.select().from(S.users).where(eq(S.users.email, EMAIL)).limit(1);
if (exists) { console.log(`Conta já existe.\n  e-mail: ${EMAIL}\n  senha:  ${PASSWORD} (a senha original, se não foi alterada)`); process.exit(0); }

const now = new Date();
const [u] = await db.insert(S.users).values({ email: EMAIL, name: "Marina Souza (demo)", passwordHash: await hashPassword(PASSWORD), emailVerifiedAt: now, termsVersion: TERMS_VERSION, termsAcceptedAt: now, onboardingDoneAt: now }).returning();
const [org] = await db.insert(S.orgs).values({ name: "Espaço pessoal", kind: "personal", ownerId: u.id }).returning();
await db.insert(S.memberships).values({ orgId: org.id, userId: u.id, role: "teacher" });
await db.insert(S.subscriptions).values({ orgId: org.id, plan: "teacher", periodStart: now, periodEnd: new Date(now.getTime() + 365 * 864e5) });

const [cls] = await db.insert(S.classes).values({ orgId: org.id, name: "9º A", grade: "9", subject: "matematica", year: now.getFullYear(), createdBy: u.id }).returning();
await db.insert(S.classTeachers).values({ classId: cls.id, userId: u.id });
const names = ["Ana Souza", "Bruno Dias", "Carlos Lima", "Daniela Reis", "Eduardo Alves", "Fernanda Costa", "Gabriel Nunes", "Helena Mota"];
const studs = await db.insert(S.students).values(names.map((n, i) => ({ orgId: org.id, name: n, registration: `2026${String(i + 1).padStart(3, "0")}` }))).returning();
await db.insert(S.enrollments).values(studs.map((s) => ({ classId: cls.id, studentId: s.id })));

const items = await db.insert(S.gradeItems).values([
  { classId: cls.id, title: "Prova 1", category: "prova", period: "1º bimestre", weight: "2", maxPoints: "10" },
  { classId: cls.id, title: "Trabalho 1", category: "trabalho", period: "1º bimestre", weight: "1", maxPoints: "10" },
]).returning();
const marks = [[9, 8], [3, 4], [5, 6], [7.5, 8], [6, 5.5], [8.5, 9], [4.5, 6], [10, 9.5]];
await db.insert(S.grades).values(studs.flatMap((s, i) => items.map((it, k) => ({ gradeItemId: it.id, studentId: s.id, value: String(marks[i][k]), state: "value", source: "manual", updatedBy: u.id }))));

for (let d = 1; d <= 4; d++) {
  const date = new Date(now.getTime() - 3 * 3600e3 - d * 864e5).toISOString().slice(0, 10);
  const [sess] = await db.insert(S.attendanceSessions).values({ orgId: org.id, classId: cls.id, subject: "matematica", date, takenBy: u.id }).returning();
  await db.insert(S.attendanceRecords).values(studs.map((s, i) => ({ sessionId: sess.id, studentId: s.id, status: i === 1 && d <= 3 ? "absent" : i === 6 && d === 2 ? "absent" : "present", updatedBy: u.id })));
}
console.log(`Conta criada.\n  e-mail: ${EMAIL}\n  senha:  ${PASSWORD}\n  turma:  9º A (8 alunos, 2 atividades com notas, 4 chamadas)`);
