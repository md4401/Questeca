import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reportCards } from "@/db/schema";
import { requirePortal } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Boletim" };
export default async function PortalBoletim({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const sp = await searchParams; const p = await requirePortal(sp.aluno);
  const rows = await db.select().from(reportCards).where(and(eq(reportCards.studentId, p.student.id), eq(reportCards.published, true))).orderBy(desc(reportCards.createdAt));
  return (
    <div className="space-y-4"><StudentSwitch list={p.students} active={p.student.id} base="/portal/boletim" /><h1>Boletim</h1>
      {rows.length === 0 ? <p className="card text-ink-soft">Nenhum boletim publicado ainda.</p> : <ul className="space-y-2">{rows.map((r) => <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2"><span><strong>{r.period}</strong> <span className="hint">· emitido em {fmtDateTime(r.createdAt)}</span></span><a className="btn btn-ghost btn-sm" href={`/api/boletim/${r.id}`}>Abrir PDF</a></li>)}</ul>}
    </div>
  );
}
