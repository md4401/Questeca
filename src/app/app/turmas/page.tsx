import Link from "next/link";
import { eq, count, and } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { db } from "@/db";
import { enrollments } from "@/db/schema";
import { gradeLabel, subjectLabel } from "@/lib/taxonomy";
import { can } from "@/lib/core/permissions";

export const metadata = { title: "Turmas" };

export default async function Turmas() {
  const ctx = await requireCtx();
  const list = await visibleClasses(ctx);
  const counts = await Promise.all(list.map(async (c) => ({ id: c.id, n: Number((await db.select({ n: count() }).from(enrollments).where(and(eq(enrollments.classId, c.id), eq(enrollments.status, "active"))))[0].n) })));
  const nBy = new Map(counts.map((c) => [c.id, c.n]));
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><h1>Turmas</h1><p className="hint">{ctx.org.name}</p></div>
        {can(ctx.org.role, "class.create") && <Link className="btn" href="/app/turmas/nova">Nova turma</Link>}
      </div>
      {ctx.org.role === "admin" && list.length === 0 && <p className="card-tint">A gestão institucional não tem acesso pedagógico por padrão. Para ver turmas, atribua-se a uma turma ou peça a permissão à coordenação.</p>}
      {list.length === 0 && ctx.org.role !== "admin" ? (
        <div className="card"><p>Você ainda não tem turmas aqui. Crie uma para começar — nomes de alunos podem ser adicionados depois.</p><p className="mt-3"><Link className="btn" href="/app/turmas/nova">Criar primeira turma</Link></p></div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <li key={c.id} className="card">
              <h2 className="text-lg"><Link href={`/app/turmas/${c.id}`}>{c.name}</Link></h2>
              <p className="hint">{gradeLabel(c.grade)} · {subjectLabel(c.subject)} · {c.year}</p>
              <p className="mt-2 text-sm">{nBy.get(c.id) ?? 0} aluno(s) {c.isDemo && <span className="badge badge-amber ml-1">Exemplo</span>}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
