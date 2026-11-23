import Link from "next/link";
import { and, eq, desc, isNull, count } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { db } from "@/db";
import { assessments, notifications, documents } from "@/db/schema";
import { gradeLabel, subjectLabel } from "@/lib/taxonomy";
import { planInfo } from "@/lib/billing";
import { PLANS } from "@/lib/core/plans";
import { redirect } from "next/navigation";
import { fmtDateTime } from "@/lib/format";
import { ensureReminders } from "@/lib/events";
import { loadLessonNow } from "@/lib/lesson-now";
import { AulaDeAgora } from "./aula-agora/panel";
import { Icon } from "@/components/icons";
import { classSummaries } from "@/lib/class-summary";
import { gradeSubmissions, students as studentsT, classes as classesT } from "@/db/schema";

export const metadata = { title: "Início" };

export default async function Inicio({ searchParams }: { searchParams: Promise<{ novo?: string; turma?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const cls = await visibleClasses(ctx);
  if (!ctx.user.onboardingDoneAt && cls.length === 0 && ctx.org.role === "teacher") redirect("/cadastro");
  await ensureReminders({ orgId: ctx.org.id, userId: ctx.user.id, classIds: cls.map((c) => c.id), href: "/app/agenda" });
  const drafts = await db.select().from(assessments).where(and(eq(assessments.orgId, ctx.org.id), eq(assessments.ownerId, ctx.user.id), eq(assessments.status, "draft"))).orderBy(desc(assessments.updatedAt)).limit(3);
  const notes = await db.select().from(notifications).where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt))).orderBy(desc(notifications.createdAt)).limit(5);
  const reviews = ctx.org.role === "coordinator" || ctx.org.role === "admin" ? await db.select().from(documents).where(and(eq(documents.orgId, ctx.org.id), eq(documents.status, "in_review"))).limit(5) : [];
  const info = await planInfo(ctx.org.id);
  const lessonNow = ctx.org.role === "admin" ? null : await loadLessonNow(ctx);
  const [dc] = await db.select({ n: count() }).from(assessments).where(and(eq(assessments.orgId, ctx.org.id), eq(assessments.ownerId, ctx.user.id), eq(assessments.status, "draft")));
  const summ = await classSummaries(cls.map((c) => c.id));
  const totalStudents = [...summ.byClass.values()].reduce((a, v) => a + v.students, 0);
  const submissions = await db.select({ s: gradeSubmissions, student: studentsT.name, cls: classesT.name }).from(gradeSubmissions)
    .innerJoin(studentsT, eq(studentsT.id, gradeSubmissions.studentId)).innerJoin(classesT, eq(classesT.id, gradeSubmissions.classId))
    .where(and(eq(gradeSubmissions.orgId, ctx.org.id), ctx.org.role === "coordinator" ? undefined : eq(gradeSubmissions.submittedBy, ctx.user.id))).orderBy(desc(gradeSubmissions.submittedAt)).limit(6);
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" });
  const staffView = ctx.org.role !== "admin";
  const attention = notes.length + reviews.length;
  return (
    <div className="space-y-6">
      <div className="page-head">
        <div><h1>Olá, {ctx.user.name.split(" ")[0]}</h1><p className="capitalize-first">{today} · {ctx.org.name}{ctx.org.city ? ` · ${ctx.org.city}/${ctx.org.uf}` : ""}</p></div>
        {staffView && <div className="actions"><Link className="btn" href="/app/provas/nova">Criar prova</Link></div>}
      </div>
      {sp.novo && cls.length > 0 && (
        <section className="card-tint space-y-2" aria-label="Cadastro concluído">
          <p className="font-semibold">Cadastro concluído. Sua turma está pronta.</p>
          <p className="text-sm text-ink-soft">{cls.slice(0, 3).map((c) => `${subjectLabel(c.subject)} · ${c.name}`).join(" · ")}{cls.length > 3 ? ` e mais ${cls.length - 3}` : ""}</p>
          <Link className="btn" href={`/app/provas/nova${sp.turma ? `?turma=${sp.turma}` : ""}`}>Criar minha primeira prova</Link>
          {cls.some((c) => c.subject !== "matematica") && <p className="hint">O acervo de questões ainda cobre Matemática. As outras disciplinas ficam salvas no seu perfil.</p>}
        </section>)}
      {staffView && (
        <section className="stat-grid" aria-label="Resumo">
          <Link href="/app/turmas" className="stat"><span className="stat-icon" data-c="blue"><Icon name="turmas" size={22} /></span><strong>{cls.length}</strong><span>Turmas</span></Link>
          <Link href="/app/turmas" className="stat"><span className="stat-icon" data-c="green"><Icon name="chamada" size={22} /></span><strong>{totalStudents}</strong><span>Alunos</span></Link>
          <Link href="/app/turmas" className="stat" data-dot={summ.pending > 0}><span className="stat-icon" data-c="amber"><Icon name="prova" size={22} /></span><strong>{summ.pending}</strong><span>Para conferir</span></Link>
          <Link href="/app/provas" className="stat"><span className="stat-icon" data-c="red"><Icon name="prova" size={22} /></span><strong>{Number(dc?.n ?? 0)}</strong><span>Provas em rascunho</span></Link>
        </section>)}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {lessonNow && <AulaDeAgora ln={lessonNow} multiOrg={ctx.orgs.length > 1} />}
          <section className="card" aria-label="Turmas ativas"><div className="section-title"><h2>Turmas ativas</h2><Link href="/app/turmas">Ver todas</Link></div>
            {cls.length === 0 ? <p className="empty">Nenhuma turma disponível neste contexto. <Link href="/app/turmas/nova">Criar turma</Link></p> : (
              <ul className="space-y-3">{cls.map((c) => { const v = summ.byClass.get(c.id); const avg = v?.avg ?? null; const att = v?.att ?? null; return (
                <li key={c.id}><Link href={`/app/turmas/${c.id}`} className="block no-underline">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span><strong className="text-ink">{c.name}</strong> <span className="hint">· {gradeLabel(c.grade)} · {subjectLabel(c.subject)}{c.isDemo ? " · exemplo" : ""} · {v?.students ?? 0} aluno(s)</span></span>
                    <span className="flex gap-1.5"><span className="chip-status" data-s={avg == null ? "regular" : avg < 6 ? "risco" : "regular"}>Média {avg == null ? "—" : String(avg).replace(".", ",")}</span><span className="chip-status" data-s={att == null ? "regular" : att < 75 ? "risco" : "regular"}>{att == null ? "—" : `${att}%`} freq.</span></span></div>
                  <div className="pbar mt-1.5" data-tone={avg != null && avg < 6 ? "danger" : undefined} role="img" aria-label={`Média da turma ${c.name}: ${avg ?? "sem notas"}`}><i style={{ width: `${avg == null ? 0 : Math.min(100, avg * 10)}%` }} /></div>
                </Link></li>); })}</ul>)}
          </section>
          {drafts.length > 0 && <section className="card"><div className="section-title"><h2>Rascunhos recentes</h2><Link href="/app/provas">Ver provas</Link></div><ul className="list-rows">{drafts.map((d) => <li key={d.id}><Link href={`/app/provas/${d.id}`}>{d.title}</Link> <span className="hint">· {fmtDateTime(d.updatedAt)}</span></li>)}</ul></section>}
        </div>
        <div className="space-y-6">
          {attention > 0 && <section className="card" aria-label="Pendências"><h2 className="section-title">Pendências</h2><ul className="list-rows text-sm">{reviews.map((r) => <li key={r.id}>Documento para revisar: <Link href="/app/documentos">{r.title}</Link></li>)}{notes.map((n) => <li key={n.id}>{n.href ? <Link href={n.href}>{n.title}</Link> : n.title}</li>)}</ul></section>}
          {submissions.length > 0 && (
            <section className="card" aria-label="Notas enviadas por QR" data-testid="notas-qr">
              <h2 className="section-title">{ctx.org.role === "coordinator" ? "Notas recebidas dos professores" : "Notas que você enviou à escola"}</h2>
              <ul className="list-rows text-sm">{submissions.map(({ s, student, cls: cn }) => <li key={s.id}><Link href={`/app/turmas/${s.classId}/notas`}>{student}</Link> · {cn} · <strong>{String(Number(s.value)).replace(".", ",")}</strong>/{String(Number(s.maxPoints)).replace(".", ",")} <span className="hint">({fmtDateTime(s.submittedAt)})</span></li>)}</ul>
            </section>)}
          <section className="card-tint text-sm">Plano <strong>{PLANS[info.plan].name}</strong>: {info.used.assemblies}/{info.limits.assemblies >= 10000 ? "∞" : info.limits.assemblies} montagens assistidas neste ciclo (renova em {info.cycleEnd.toLocaleDateString("pt-BR", { timeZone: "UTC" })}). <Link href="/app/plano">Ver plano</Link></section>
        </div>
      </div>
    </div>
  );
}
