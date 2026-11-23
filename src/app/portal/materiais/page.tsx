import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { materials, classes } from "@/db/schema";
import { requirePortal, anyOf } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Materiais" };

export default async function PortalMateriais({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const sp = await searchParams;
  const p = await requirePortal(sp.aluno);
  const rows = await db.select({ m: materials, cname: classes.name }).from(materials).innerJoin(classes, eq(classes.id, materials.classId))
    .where(and(eq(materials.orgId, p.ctx.org.id), eq(materials.visibility, "class"), eq(materials.approval, "approved"), inArray(materials.classId, anyOf(p.classIds)))).orderBy(desc(materials.createdAt));
  return (
    <div className="space-y-4">
      <StudentSwitch list={p.students} active={p.student.id} base="/portal/materiais" />
      <h1>Materiais</h1>
      {rows.length === 0 ? <p className="card text-ink-soft">Nenhum material compartilhado com a turma.</p> : (
        <ul className="space-y-3">{rows.map(({ m, cname }) => (
          <li key={m.id} className="card"><p className="text-xs text-ink-soft">{cname} · {fmtDateTime(m.createdAt)}</p><h2 className="text-lg">{m.title}</h2>
            {m.description && <p className="text-sm">{m.description}</p>}{m.text && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{m.text.slice(0, 600)}{m.text.length > 600 ? "…" : ""}</p>}
            <p className="mt-2 flex gap-4 text-sm">{m.file && <a href={`/api/material/${m.id}`}>Baixar arquivo</a>}{m.url && <a href={m.url} target="_blank" rel="noreferrer noopener">Abrir link</a>}</p></li>))}</ul>)}
    </div>
  );
}
