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
import { ensureReminders, loadAgenda } from "@/lib/events";
import { addDaysISO, fromSP, spISO } from "@/lib/core/calendar";
import { todayISO } from "@/lib/format";
import { CAT_COLOR, CAT_LABEL } from "@/components/month-calendar";
import { loadLessonNow } from "@/lib/lesson-now";
import { AulaDeAgora } from "./aula-agora/panel";
import { Icon } from "@/components/icons";
import { classSummaries } from "@/lib/class-summary";
import { gradeSubmissions, students as studentsT, classes as classesT, gradeItems } from "@/db/schema";
import { inArray } from "drizzle-orm";

export const metadata = { title: "Início" };

export default async function Inicio({ searchParams }: { searchParams: Promise<{ novo?: string; turma?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const cls = await visibleClasses(ctx);
  if (!ctx.user.onboardingDoneAt && cls.length === 0 && ctx.org.role === "teacher") redirect("/cadastro");
  await ensureReminders({ orgId: ctx.org.id, userId: ctx.user.id, classIds: cls.map((c) => c.id), href: "/app/agenda" });
  const drafts = await db.select({ id: assessments.id, title: assessments.title, updatedAt: assessments.updatedAt, className: classesT.name }).from(assessments).leftJoin(classesT, eq(classesT.id, assessments.classId)).where(and(eq(assessments.orgId, ctx.org.id), eq(assessments.ownerId, ctx.user.id), eq(assessments.status, "draft"))).orderBy(desc(assessments.updatedAt)).limit(3);
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
  const [totalExams] = await db.select({ n: count() }).from(assessments).where(and(eq(assessments.orgId, ctx.org.id), eq(assessments.ownerId, ctx.user.id)));
  const [gradedItems] = cls.length ? await db.select({ n: count() }).from(gradeItems).where(inArray(gradeItems.classId, cls.map((c) => c.id))) : [{ n: 0 }];
  const todayIso = todayISO();
  const upcoming = (await loadAgenda({ orgId: ctx.org.id, userId: ctx.user.id, classIds: cls.map((c) => c.id), from: fromSP(todayIso), to: fromSP(addDaysISO(todayIso, 14), "23:59") })).slice(0, 4);
  const hour = Number(new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }));
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstClass = cls[0];
  const steps = [
    { done: cls.length > 0, label: "Criar sua turma", href: "/app/turmas/nova" },
    { done: totalStudents > 0, label: "Adicionar os alunos", href: firstClass ? `/app/turmas/${firstClass.id}/alunos` : "/app/turmas/nova" },
    { done: Number(totalExams?.n ?? 0) > 0, label: "Criar a primeira prova", href: "/app/provas/nova" },
    { done: Number(gradedItems?.n ?? 0) > 0, label: "Lançar as primeiras notas", href: "/app/notas" },
  ];
  const stepsLeft = steps.filter((x) => !x.done).length;
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" });
  const staffView = ctx.org.role !== "admin";
  const attention = notes.length + reviews.length;
  return (
    <div className="space-y-6">
      <div className="page-head">
        <div><h1>{greet}, {ctx.user.name.split(" ")[0]}</h1><p className="capitalize-first">{today} · {ctx.org.name}{ctx.org.city ? ` · ${ctx.org.city}/${ctx.org.uf}` : ""}</p></div>
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
      {staffView && stepsLeft > 0 && (
        <section className="card" aria-label="Primeiros passos" data-testid="primeiros-passos">
          <div className="section-title"><h2>Primeiros passos</h2><span className="hint">{steps.length - stepsLeft} de {steps.length} concluídos</span></div>
          <div className="pbar mb-3" role="img" aria-label={`${steps.length - stepsLeft} de ${steps.length} passos concluídos`}><i style={{ width: `${((steps.length - stepsLeft) / steps.length) * 100}%` }} /></div>
          <ol className="grid gap-2 sm:grid-cols-2">{steps.map((st, i) => (
            <li key={st.label}><Link href={st.href} className={`flex items-center gap-3 rounded-lg border border-line p-3 no-underline ${st.done ? "opacity-60" : "hover:border-sky"}`}>
              <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-sm font-bold ${st.done ? "bg-[var(--color-ok-tint)] text-ok" : "bg-brand-tint text-brand"}`} aria-hidden>{st.done ? "✓" : i + 1}</span>
              <span className={`font-semibold text-ink ${st.done ? "line-through" : ""}`}>{st.label}</span><span className="sr-only">{st.done ? " (concluído)" : " (pendente)"}</span></Link></li>))}</ol>
        </section>)}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {lessonNow && <AulaDeAgora ln={lessonNow} multiOrg={ctx.orgs.length > 1} />}
          <section className="card" aria-label="Turmas ativas"><div className="section-title"><h2>Minhas turmas</h2><Link href="/app/turmas">Ver todas</Link></div>
            {cls.length === 0 ? <p className="empty">Nenhuma turma disponível neste contexto. <Link href="/app/turmas/nova">Criar turma</Link></p> : (
              <ul className="grid gap-2.5 sm:grid-cols-2">{cls.slice(0, 6).map((c) => { const v = summ.byClass.get(c.id); const avg = v?.avg ?? null; const att = v?.att ?? null; return (
                <li key={c.id}><Link href={`/app/turmas/${c.id}`} className="block rounded-xl border border-line p-3 no-underline hover:border-sky">
                  <p className="truncate font-semibold text-ink">{c.name}</p>
                  <p className="hint truncate">{gradeLabel(c.grade)} · {subjectLabel(c.subject)}{c.isDemo ? " · exemplo" : ""}</p>
                  <p className="mt-2 flex flex-wrap gap-1.5 text-sm"><span className="chip-status" data-s="regular">{v?.students ?? 0} aluno(s)</span>{avg != null && <span className="chip-status" data-s={avg < 6 ? "risco" : "regular"}>Média {String(avg).replace(".", ",")}</span>}{att != null && <span className="chip-status" data-s={att < 75 ? "risco" : "regular"}>{att}% freq.</span>}</p>
                </Link></li>); })}</ul>)}
            {cls.length > 6 && <p className="mt-3 text-sm"><Link href="/app/turmas">Ver as outras {cls.length - 6} turmas</Link></p>}
          </section>
          {drafts.length > 0 && <section className="card"><div className="section-title"><h2>Trabalhos recentes</h2><Link href="/app/provas">Ver provas</Link></div><ul className="list-rows">{drafts.map((d) => <li key={d.id}><Link href={`/app/provas/${d.id}`}>{d.title}</Link><br /><span className="hint">{d.className ?? "Sem turma"} · {fmtDateTime(d.updatedAt)}</span></li>)}</ul></section>}
        </div>
        <div className="space-y-6">
          <section className="card" aria-label="Próximos eventos"><div className="section-title"><h2>Agenda</h2><Link href="/app/agenda">Abrir</Link></div>
            {upcoming.length === 0 ? <p className="empty !py-4">Nada marcado para os próximos dias.</p> : (
              <ul className="space-y-3">{upcoming.map((e) => { const d = spISO(e.start); return (
                <li key={e.key} className="flex items-center gap-3"><span className="date-chip" style={{ ["--c" as string]: CAT_COLOR[e.category] ?? "#64748B" }} aria-hidden>{Number(d.slice(8))}</span>
                  <span className="min-w-0"><span className="block truncate font-semibold">{e.title}</span><span className="hint">{CAT_LABEL[e.category] ?? e.category}{d === todayIso ? " · hoje" : ""}</span></span></li>); })}</ul>)}
          </section>
          {attention > 0 && <section className="card" aria-label="Pendências"><h2 className="section-title">Pendências</h2><ul className="list-rows text-sm">{reviews.map((r) => <li key={r.id}>Documento para revisar: <Link href="/app/documentos">{r.title}</Link></li>)}{notes.map((n) => <li key={n.id}>{n.href ? <Link href={n.href}>{n.title}</Link> : n.title}</li>)}</ul></section>}
          {submissions.length > 0 && (
            <section className="card" aria-label="Notas enviadas por QR" data-testid="notas-qr">
              <h2 className="section-title">{ctx.org.role === "coordinator" ? "Notas recebidas dos professores" : "Notas que você enviou à escola"}</h2>
              <ul className="list-rows text-sm">{submissions.map(({ s, student, cls: cn }) => <li key={s.id}><Link href={`/app/turmas/${s.classId}/notas`}>{student}</Link> · {cn} · <strong>{String(Number(s.value)).replace(".", ",")}</strong>/{String(Number(s.maxPoints)).replace(".", ",")} <span className="hint">({fmtDateTime(s.submittedAt)})</span></li>)}</ul>
            </section>)}
          <p className="hint">Plano <strong>{PLANS[info.plan].name}</strong>: {info.used.assemblies}/{info.limits.assemblies >= 10000 ? "∞" : info.limits.assemblies} montagens neste ciclo. <Link href="/app/plano">Ver plano</Link></p>
        </div>
      </div>
    </div>
  );
}
