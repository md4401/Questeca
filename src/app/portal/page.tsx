import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requirePortal, anyOf } from "@/lib/portal";
import { tasks, taskSubmissions } from "@/db/schema";
import { inArray, ne } from "drizzle-orm";
import { loadAgenda, ensureReminders } from "@/lib/events";
import { fromSP, spISO } from "@/lib/core/calendar";
import { studentStatus } from "@/lib/core/tasks";
import { todayISO } from "@/lib/format";
import { StudentSwitch } from "@/components/student-switch";
import { gradeLabel, subjectLabel } from "@/lib/taxonomy";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Início" };

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const sp = await searchParams;
  const p = await requirePortal(sp.aluno);
  await ensureReminders({ orgId: p.ctx.org.id, userId: p.ctx.user.id, classIds: p.classIds, href: "/portal/agenda" });
  const today = todayISO();
  const agenda = (await loadAgenda({ orgId: p.ctx.org.id, userId: p.ctx.user.id, classIds: p.classIds, from: fromSP(today), to: fromSP(today, "23:59"), taskHref: (id) => `/portal/tarefas/${id}` })).filter((i) => spISO(i.start) === today);
  const tlist = await db.select().from(tasks).where(and(inArray(tasks.classId, anyOf(p.classIds)), ne(tasks.status, "draft"))).orderBy(tasks.dueAt);
  const tsubs = tlist.length ? await db.select().from(taskSubmissions).where(and(inArray(taskSubmissions.taskId, tlist.map((x) => x.id)), eq(taskSubmissions.studentId, p.student.id))) : [];
  const now = new Date();
  const todo = tlist.map((x) => { const s = tsubs.find((y) => y.taskId === x.id); return { x, st: studentStatus(x, s ? { status: s.status, submittedAt: s.submittedAt, grade: s.grade } : null, now) }; }).filter((r) => r.st === "pendente" || r.st === "rascunho" || r.st === "atrasada").slice(0, 4);
  const notes = await db.select().from(notifications).where(and(eq(notifications.userId, p.ctx.user.id), isNull(notifications.readAt))).orderBy(desc(notifications.createdAt)).limit(5);
  return (
    <div className="space-y-6">
      <StudentSwitch list={p.students} active={p.student.id} base="/portal" />
      <div><h1>Olá, {p.ctx.user.name.split(" ")[0]}</h1>
        <p className="hint">{p.ctx.org.role === "guardian" ? `Acompanhando ${p.student.name}` : p.student.name} · {p.ctx.org.name}</p></div>
      <section className="card"><h2 className="mb-2 text-lg">Para fazer</h2>
        {todo.length === 0 ? <p className="text-sm text-ink-soft">Nenhuma tarefa pendente.</p> : <ul className="space-y-1 text-sm">{todo.map(({ x, st }) => <li key={x.id}><Link href={`/portal/tarefas/${x.id}${p.students.length > 1 ? `?aluno=${p.student.id}` : ""}`}>{x.title}</Link> <span className="hint">· {x.dueAt ? `prazo ${fmtDateTime(x.dueAt)}` : "sem prazo"}{st === "atrasada" ? " · atrasada" : ""}</span></li>)}</ul>}
        <Link className="link-btn mt-2 inline-block" href="/portal/tarefas">Ver todas</Link></section>
      <section className="card"><h2 className="mb-2 text-lg">Hoje</h2>
        {agenda.length === 0 ? <p className="text-sm text-ink-soft">Nada na agenda de hoje.</p> : <ul className="space-y-1 text-sm">{agenda.map((a) => <li key={a.key}>{a.href ? <Link href={a.href}>{a.title}</Link> : a.title}</li>)}</ul>}
        <Link className="link-btn mt-2 inline-block" href="/portal/agenda">Abrir agenda</Link></section>
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
