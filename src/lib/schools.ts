import "server-only";
import { and, eq, like, sql, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { normalize } from "@/lib/taxonomy";

export type SchoolHit = { id: string; name: string; city: string; uf: string; neighborhood: string | null; dependency: string | null };

const esc = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

/** Busca por partes do nome (sem acento/caixa); prioriza o município escolhido e nomes que começam com o termo. */
export async function searchSchools(opts: { q: string; uf?: string; city?: string; limit?: number }): Promise<SchoolHit[]> {
  const terms = normalize(opts.q).split(/[^a-z0-9]+/).filter((t) => t.length >= 1).slice(0, 6);
  if (normalize(opts.q).replace(/[^a-z0-9]/g, "").length < 2) return [];
  const conds = terms.map((t) => like(schools.nameNorm, `%${esc(t)}%`));
  if (opts.uf && /^[A-Z]{2}$/.test(opts.uf)) conds.push(eq(schools.uf, opts.uf));
  const city = opts.city ? normalize(opts.city).trim() : "";
  if (city) conds.push(like(schools.cityNorm, `${esc(city)}%`));
  const first = terms[0] ?? "";
  const rows = await db.select({ id: schools.id, name: schools.name, city: schools.city, uf: schools.uf, neighborhood: schools.neighborhood, dependency: schools.dependency })
    .from(schools).where(and(...conds))
    .orderBy(desc(sql`(${schools.nameNorm} like ${esc(first) + "%"})`), schools.name)
    .limit(Math.min(opts.limit ?? 8, 12));
  return rows;
}

let cached: { n: number; at: number } | null = null;
/** Tamanho do catálogo (cache de 10 min) para indicar cobertura parcial. */
export async function catalogSize() {
  if (cached && Date.now() - cached.at < 600_000) return cached.n;
  const [r] = await db.select({ n: count() }).from(schools);
  cached = { n: Number(r?.n ?? 0), at: Date.now() };
  return cached.n;
}
export const FULL_CATALOG_MIN = 100_000; // o Censo Escolar tem ~180 mil escolas ativas

export async function getSchool(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [s] = await db.select().from(schools).where(eq(schools.id, id)).limit(1);
  return s ?? null;
}
