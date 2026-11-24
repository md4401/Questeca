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
import { loadIndicadores } from "@/lib/indicadores";
import { gradeSubmissions, students as studentsT, classes as classesT, gradeItems, grades } from "@/db/schema";
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
  const ind = await loadIndicadores({ orgId: ctx.org.id, userId: ctx.user.id, classIds: cls.map((c) => c.id) });
  const totalStudents = [...summ.byClass.values()].reduce((a, v) => a + v.students, 0);
  const submissions = await db.select({ s: gradeSubmissions, student: studentsT.name, cls: classesT.name }).from(gradeSubmissions)
    .innerJoin(studentsT, eq(studentsT.id, gradeSubmissions.studentId)).innerJoin(classesT, eq(classesT.id, gradeSubmissions.classId))
    .where(and(eq(gradeSubmissions.orgId, ctx.org.id), ctx.org.role === "coordinator" ? undefined : eq(gradeSubmissions.submittedBy, ctx.user.id))).orderBy(desc(gradeSubmissions.submittedAt)).limit(6);
  const [totalExams] = await db.select({ n: count() }).from(assessments).where(and(eq(assessments.orgId, ctx.org.id), eq(assessments.ownerId, ctx.user.id)));
  const [gradedItems] = cls.length ? await db.select({ n: count() }).from(gradeItems).where(inArray(gradeItems.classId, cls.map((c) => c.id))) : [{ n: 0 }];
  const todayIso = todayISO();
  const upcoming = (await loadAgenda({ orgId: ctx.org.id, userId: ctx.user.id, classIds: cls.map((c) => c.id), from: fromSP(todayIso), to: fromSP(addDaysISO(todayIso, 14), "23:59") })).slice(0, 3);
  const recentExams = await db.select({ id: assessments.id, title: assessments.title, status: assessments.status, className: classesT.name, updatedAt: assessments.updatedAt }).from(assessments).leftJoin(classesT, eq(classesT.id, assessments.classId)).where(and(eq(assessments.orgId, ctx.org.id), eq(assessments.ownerId, ctx.user.id))).orderBy(desc(assessments.updatedAt)).limit(3);
  const recentItems = cls.length ? await db.select({ id: gradeItems.id, title: gradeItems.title, classId: gradeItems.classId, className: classesT.name, period: gradeItems.period, max: gradeItems.maxPoints }).from(gradeItems).innerJoin(classesT, eq(classesT.id, gradeItems.classId)).where(inArray(gradeItems.classId, cls.map((c) => c.id))).orderBy(desc(gradeItems.createdAt)).limit(3) : [];
  const itemGrades = recentItems.length ? await db.select({ itemId: grades.gradeItemId, v: grades.value, st: grades.state }).from(grades).where(inArray(grades.gradeItemId, recentItems.map((i) => i.id))) : [];
  const itemAvg = (id: string, max: string) => { const v = itemGrades.filter((g) => g.itemId === id && (g.st === "value" || g.st === "zero") && g.v != null).map((g) => Number(g.v)); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length / (Number(max) || 10)) * 100) / 10 : null; };
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
        {staffView && <div className="actions">{drafts[0] && <Link className="btn btn-ghost" href={`/app/provas/${drafts[0].id}`}>Continuar “{drafts[0].title.length > 24 ? drafts[0].title.slice(0, 24) + "…" : drafts[0].title}”</Link>}<Link className="btn" href="/app/provas/nova">Criar prova</Link></div>}
      </div>
      {staffView && (
        <>
          <section aria-label="Indicadores" data-testid="indicadores">
            <ul className="grid-5 kpi-grid">
              {[
                { k: "turmas", label: "Turmas", v: ind.turmas, href: "/app/turmas" },
                { k: "alunos", label: "Alunos", v: ind.alunos, href: cls[0] ? `/app/turmas/${cls[0].id}/alunos` : "/app/turmas" },
                { k: "criadas", label: "Provas criadas", v: ind.provasCriadas, href: "/app/provas" },
                { k: "aplicadas", label: "Provas aplicadas", v: ind.provasAplicadas, href: "/app/provas" },
                { k: "pendentes", label: "Atividades pendentes", v: ind.atividadesPendentes, href: "/app/notas", warn: ind.atividadesPendentes > 0 },
              ].map((i) => (
                <li key={i.k}><Link href={i.href} className="kpi" data-testid={`kpi-${i.k}`} data-warn={i.warn ? "1" : undefined}><strong>{i.v}</strong><span>{i.label}</span></Link></li>))}
            </ul>
          </section>
          <section aria-label="Atalhos rápidos" data-testid="atalhos-rapidos">
            <ul className="grid-5 quick-grid">
              {([
                { icon: "prova", label: "Criar prova", href: "/app/provas/montar" },
                { icon: "turmas", label: "Cadastrar aluno", href: cls[0] ? `/app/turmas/${cls[0].id}/alunos` : "/app/turmas/nova" },
                { icon: "escola", label: "Criar turma", href: "/app/turmas/nova" },
                { icon: "nota", label: "Consultar notas", href: "/app/notas" },
                { icon: "banco", label: "Banco de questões", href: "/app/banco" },
              ] as const).map((a) => (
                <li key={a.label}><Link href={a.href} className="atalho-rapido"><Icon name={a.icon} size={22} /><span>{a.label}</span></Link></li>))}
            </ul>
          </section>
        </>)}
      {sp.novo && cls.length > 0 && (
        <section className="card-tint space-y-2" aria-label="Cadastro concluído">
          <p className="font-semibold">Cadastro concluído. Sua turma está pronta.</p>
          <p className="text-sm text-ink-soft">{cls.slice(0, 3).map((c) => `${subjectLabel(c.subject)} · ${c.name}`).join(" · ")}{cls.length > 3 ? ` e mais ${cls.length - 3}` : ""}</p>
          <Link className="btn" href={`/app/provas/nova${sp.turma ? `?turma=${sp.turma}` : ""}`}>Criar minha primeira prova</Link>
          {cls.some((c) => c.subject !== "matematica") && <p className="hint">O acervo de questões ainda cobre Matemática. As outras disciplinas ficam salvas no seu perfil.</p>}
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
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {lessonNow && <AulaDeAgora ln={lessonNow} multiOrg={ctx.orgs.length > 1} />}
          <section className="card" aria-label="Turmas ativas"><div className="section-title"><h2>Minhas turmas</h2><Link href="/app/turmas">Ver todas</Link></div>
            {cls.length === 0 ? <p className="empty">Nenhuma turma disponível neste contexto. <Link href="/app/turmas/nova">Criar turma</Link></p> : (
              <ul className="grid gap-2.5 sm:grid-cols-2">{cls.slice(0, 4).map((c) => { const v = summ.byClass.get(c.id); const avg = v?.avg ?? null; const att = v?.att ?? null; return (
                <li key={c.id}><Link href={`/app/turmas/${c.id}`} className="block rounded-xl border border-line p-3 no-underline hover:border-sky">
                  <p className="truncate font-semibold text-ink">{c.name}</p>
                  <p className="hint truncate">{gradeLabel(c.grade)} · {subjectLabel(c.subject)}{c.isDemo ? " · exemplo" : ""}</p>
                  <p className="mt-2 flex flex-wrap gap-1.5 text-sm"><span className="chip-status" data-s="regular">{v?.students ?? 0} aluno(s)</span>{avg != null && <span className="chip-status" data-s={avg < 6 ? "risco" : "regular"}>Média {String(avg).replace(".", ",")}</span>}{att != null && <span className="chip-status" data-s={att < 75 ? "risco" : "regular"}>{att}% freq.</span>}</p>
                </Link></li>); })}</ul>)}
            {cls.length > 4 && <p className="mt-3 text-sm"><Link href="/app/turmas">Ver as outras {cls.length - 4} turmas</Link></p>}
          </section>
          {recentItems.length > 0 && (
            <section className="card" aria-label="Notas recentes"><div className="section-title"><h2>Notas recentes</h2><Link href="/app/notas">Abrir notas</Link></div>
              <ul className="list-rows text-sm">{recentItems.map((i) => { const a = itemAvg(i.id, i.max); return <li key={i.id} className="flex items-center justify-between gap-3"><span><Link href={`/app/notas?turma=${i.classId}&periodo=${encodeURIComponent(i.period)}`}>{i.title}</Link><br /><span className="hint">{i.className} · {i.period}</span></span><span className="chip-status" data-s={a == null ? "regular" : a < 6 ? "risco" : "regular"}>{a == null ? "sem notas" : `média ${String(a).replace(".", ",")}`}</span></li>; })}</ul>
            </section>)}
        </div>
        <div className="space-y-6">
          <section className="card" aria-label="Próximos eventos"><div className="section-title"><h2>Agenda</h2><Link href="/app/agenda">Abrir</Link></div>
            {upcoming.length === 0 ? <p className="empty !py-4">Nada marcado para os próximos dias.</p> : (
              <ul className="space-y-3">{upcoming.map((e) => { const d = spISO(e.start); return (
                <li key={e.key} className="flex items-center gap-3"><span className="date-chip" style={{ ["--c" as string]: CAT_COLOR[e.category] ?? "#64748B" }} aria-hidden>{Number(d.slice(8))}</span>
                  <span className="min-w-0"><span className="block truncate font-semibold">{e.title}</span><span className="hint">{CAT_LABEL[e.category] ?? e.category}{d === todayIso ? " · hoje" : ""}</span></span></li>); })}</ul>)}
          </section>
          {recentExams.length > 0 && (
            <section className="card" aria-label="Provas recentes"><div className="section-title"><h2>Provas</h2><Link href="/app/provas">Ver todas</Link></div>
              <ul className="list-rows text-sm">{recentExams.map((e) => <li key={e.id}><Link href={`/app/provas/${e.id}`}>{e.title}</Link> <span className="badge badge-gray">{e.status === "draft" ? "rascunho" : e.status === "applied" ? "aplicada" : e.status}</span><br /><span className="hint">{e.className ?? "Sem turma"} · {fmtDateTime(e.updatedAt)}</span></li>)}</ul>
            </section>)}
          {attention > 0 && <section className="card" aria-label="Pendências"><h2 className="section-title">Pendências</h2><ul className="list-rows text-sm">{reviews.map((r) => <li key={r.id}>Documento para revisar: <Link href="/app/documentos">{r.title}</Link></li>)}{notes.map((n) => <li key={n.id}>{n.href ? <Link href={n.href}>{n.title}</Link> : n.title}</li>)}</ul></section>}
          {submissions.length > 0 && (
            <section className="card" aria-label="Notas enviadas por QR" data-testid="notas-qr">
              <h2 className="section-title">{ctx.org.role === "coordinator" ? "Notas recebidas dos professores" : "Notas que você enviou à escola"}</h2>
              <ul className="list-rows text-sm">{submissions.map(({ s, student, cls: cn }) => <li key={s.id}><Link href={`/app/turmas/${s.classId}/notas`}>{student}</Link> · {cn} · <strong>{String(Number(s.value)).replace(".", ",")}</strong>/{String(Number(s.maxPoints)).replace(".", ",")} <span className="hint">({fmtDateTime(s.submittedAt)})</span></li>)}</ul>
            </section>)}
        </div>
      </div>
    </div>
  );
}
