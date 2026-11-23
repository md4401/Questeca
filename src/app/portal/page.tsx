import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requirePortal } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";
import { gradeLabel, subjectLabel } from "@/lib/taxonomy";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Início" };

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const sp = await searchParams;
  const p = await requirePortal(sp.aluno);
  const notes = await db.select().from(notifications).where(and(eq(notifications.userId, p.ctx.user.id), isNull(notifications.readAt))).orderBy(desc(notifications.createdAt)).limit(5);
  return (
    <div className="space-y-6">
      <StudentSwitch list={p.students} active={p.student.id} base="/portal" />
      <div><h1>Olá, {p.ctx.user.name.split(" ")[0]}</h1>
        <p className="hint">{p.ctx.org.role === "guardian" ? `Acompanhando ${p.student.name}` : p.student.name} · {p.ctx.org.name}</p></div>
      <section className="card"><h2 className="mb-2 text-lg">Turmas</h2>
        {p.classes.length === 0 ? <p className="text-ink-soft">Ainda não há turma.</p> : <ul className="grid gap-2 sm:grid-cols-2">{p.classes.map((c) => <li key={c.id} className="rounded-lg border border-line p-3"><strong>{c.name}</strong><br /><span className="hint">{gradeLabel(c.grade)} · {subjectLabel(c.subject)}</span></li>)}</ul>}
      </section>
      <section className="card"><h2 className="mb-2 text-lg">Avisos recentes</h2>
        {notes.length === 0 ? <p className="text-ink-soft">Nenhum aviso novo.</p> : <ul className="space-y-1 text-sm">{notes.map((n) => <li key={n.id}>{n.href ? <Link href={n.href}>{n.title}</Link> : n.title} <span className="hint">· {fmtDateTime(n.createdAt)}</span></li>)}</ul>}
        <Link className="link-btn mt-2 inline-block" href="/portal/notificacoes">Ver todos</Link>
      </section>
    </div>
  );
}
