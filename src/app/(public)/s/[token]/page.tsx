import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classWeeks, classes } from "@/db/schema";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Matéria da semana", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Página pública (sem login): só o que o professor publicou — nunca dados de alunos. */
export default async function SemanaPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{8,24}$/.test(token)) notFound();
  const [first] = await db.select({ classId: classWeeks.classId }).from(classWeeks).where(eq(classWeeks.token, token)).limit(1);
  if (!first) notFound();
  const [row] = await db.select({ w: classWeeks, cname: classes.name }).from(classWeeks).innerJoin(classes, eq(classes.id, classWeeks.classId))
    .where(and(eq(classWeeks.classId, first.classId), eq(classWeeks.published, true))).orderBy(desc(classWeeks.weekOf)).limit(1);
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="hint">Segunda Lousa</p>
      <h1 className="mb-1 text-3xl">{(row?.cname ?? "Turma")}</h1>
      {!row ? <p className="mt-4 text-ink-soft">O professor ainda não publicou a matéria desta semana.</p> : (
        <div className="space-y-4">
          <p className="hint">Semana de {fmtDate(row.w.weekOf)}</p>
          <section className="card"><h2 className="mb-2 text-lg">Matéria da semana</h2><p className="whitespace-pre-line">{row.w.content || "—"}</p></section>
          {row.w.homework && <section className="card"><h2 className="mb-2 text-lg">Tarefa</h2><p className="whitespace-pre-line">{row.w.homework}</p></section>}
          {row.w.links.length > 0 && <section className="card"><h2 className="mb-2 text-lg">Links</h2><ul className="space-y-1">{row.w.links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.label}</a></li>)}</ul></section>}
        </div>)}
    </main>
  );
}
