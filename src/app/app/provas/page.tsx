import Link from "next/link";
import { and, eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { assessments, classes } from "@/db/schema";
import { fmtDateTime } from "@/lib/format";
import { visibleClasses } from "@/lib/access";

export const metadata = { title: "Provas" };

export default async function Provas() {
  const ctx = await requireCtx();
  const mine = await db.select({ a: assessments, cname: classes.name }).from(assessments).leftJoin(classes, eq(classes.id, assessments.classId)).where(and(eq(assessments.orgId, ctx.org.id), eq(assessments.ownerId, ctx.user.id))).orderBy(desc(assessments.updatedAt));
  const cls = await visibleClasses(ctx);
  const allowed = new Set(cls.map((c) => c.id));
  const list = mine.filter((m) => !m.a.classId || allowed.has(m.a.classId));
  return (
    <div>
      <div className="page-head">
        <h1>Provas</h1>
        <div className="flex gap-2"><Link className="btn btn-ghost" href="/app/banco">Busca no banco</Link><Link className="btn" href="/app/provas/nova">Criar prova</Link></div>
      </div>
      {list.length === 0 ? <div className="card empty"><p>Você ainda não tem provas. Descreva o que ensinou e a Questeca monta um rascunho com questões reais.</p><p className="mt-3"><Link className="btn" href="/app/provas/nova">Criar primeira prova</Link></p></div> : (
        <div className="card overflow-x-auto"><table className="t"><thead><tr><th>Prova</th><th>Turma</th><th>Situação</th><th>Atualizada</th></tr></thead><tbody>
          {list.map(({ a, cname }) => <tr key={a.id}><td><Link href={`/app/provas/${a.id}`}>{a.title}</Link></td><td>{cname ?? "—"}</td>
            <td><span className={`badge ${a.status === "applied" ? "" : "badge-gray"}`}>{a.status === "applied" ? "Aplicada" : "Rascunho"}</span>{a.parentId && <span className="badge badge-amber ml-1">2ª chamada</span>}</td><td>{fmtDateTime(a.updatedAt)}</td></tr>)}
        </tbody></table></div>)}
    </div>
  );
}
