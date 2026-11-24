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
import { semanasRecentes, acumuladoMensal, mediaDe, mensagemDesempenho } from "@/lib/core/indicadores";
import { rulesFrom } from "@/lib/gradebook";
import { Sparkline, Donut, AreaChart } from "@/components/inicio/graficos";
import { PeriodoSelect, RecentesTabs } from "@/components/inicio/inicio-client";
import { NovoEvento } from "./agenda/novo-evento";
import { enrollments, applications } from "@/db/schema";
import { gte } from "drizzle-orm";
import { gradeSubmissions, students as studentsT, classes as classesT, gradeItems, grades } from "@/db/schema";
import { inArray } from "drizzle-orm";

export const metadata = { title: "Início" };

export default async function Inicio({ searchParams }: { searchParams: Promise<{ novo?: string; turma?: string; periodo?: string }> }) {
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
  const classIds = cls.map((c) => c.id);
  const agora = new Date();
  const mesInicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1, 3));
  const [criadasMes] = await db.select({ n: count() }).from(assessments).where(and(eq(assessments.orgId, ctx.org.id), eq(assessments.ownerId, ctx.user.id), gte(assessments.createdAt, mesInicio)));
  const datasProvas = (await db.select({ d: assessments.createdAt }).from(assessments).where(and(eq(assessments.orgId, ctx.org.id), eq(assessments.ownerId, ctx.user.id)))).map((r) => r.d);
  const datasTurmas = cls.map((c) => c.createdAt);
  const datasAlunos = classIds.length ? (await db.select({ d: studentsT.createdAt }).from(studentsT).innerJoin(enrollments, eq(enrollments.studentId, studentsT.id)).where(and(inArray(enrollments.classId, classIds), eq(enrollments.status, "active")))).map((r) => r.d) : [];
  const allItems = classIds.length ? await db.select({ id: gradeItems.id, title: gradeItems.title, classId: gradeItems.classId, period: gradeItems.period, max: gradeItems.maxPoints, createdAt: gradeItems.createdAt }).from(gradeItems).where(inArray(gradeItems.classId, classIds)).orderBy(gradeItems.createdAt) : [];
  const rules = rulesFrom(ctx.org.settings);
  const periodos = [...new Set([...rules.periods, ...allItems.map((i) => i.period)])];
  const periodo = sp.periodo && periodos.includes(sp.periodo) ? sp.periodo : (allItems.length ? allItems[allItems.length - 1].period : periodos[0]);
  const itensPeriodo = allItems.filter((i) => i.period === periodo);
  const notasPeriodo = itensPeriodo.length ? await db.select({ itemId: grades.gradeItemId, v: grades.value, st: grades.state }).from(grades).where(inArray(grades.gradeItemId, itensPeriodo.map((i) => i.id))) : [];
  const norm = (itemId: string) => { const max = Number(itensPeriodo.find((i) => i.id === itemId)?.max) || 10; return notasPeriodo.filter((g) => g.itemId === itemId && (g.st === "value" || g.st === "zero") && g.v != null).map((g) => (Number(g.v) / max) * 10); };
  const pontos = itensPeriodo.map((i) => ({ nome: i.title, v: mediaDe(norm(i.id)) })).filter((p): p is { nome: string; v: number } => p.v != null);
  const mediaGeral = mediaDe(itensPeriodo.flatMap((i) => norm(i.id)));
  const desempenho = mensagemDesempenho(mediaGeral, rules.passMark);
  const kpis = [
    { k: "turmas", label: "Turmas", curto: "Turma ativa", v: ind.turmas, sub: "ativas", href: "/app/turmas", cor: "#4F6BED", tint: "var(--k-azul)", icon: "turmas" as const, serie: acumuladoMensal(datasTurmas, agora), rot: "Turmas criadas, acumulado dos últimos 6 meses" },
    { k: "alunos", label: "Alunos", curto: "Alunos", v: ind.alunos, sub: "no total", href: cls[0] ? `/app/turmas/${cls[0].id}/alunos` : "/app/turmas", cor: "#2E86DE", tint: "var(--k-ceu)", icon: "turmas" as const, serie: acumuladoMensal(datasAlunos, agora), rot: "Alunos cadastrados, acumulado dos últimos 6 meses" },
    { k: "criadas", label: "Provas criadas", curto: "Provas criadas", v: Number(criadasMes?.n ?? 0), sub: `este mês${ind.provasAplicadas ? ` · ${ind.provasAplicadas} aplicada${ind.provasAplicadas > 1 ? "s" : ""}` : ""}`, href: "/app/provas", cor: "#1FA67A", tint: "var(--k-verde)", icon: "prova" as const, serie: semanasRecentes(datasProvas, agora), rot: "Provas criadas por semana, últimas 8 semanas" },
    { k: "pendentes", label: "Atividades pendentes", curto: "Pendentes", v: ind.atividadesPendentes, sub: "para corrigir", href: "/app/notas", cor: "#F08A24", tint: "var(--k-laranja)", icon: "agenda" as const, serie: semanasRecentes(allItems.map((i) => i.createdAt), agora), rot: "Atividades criadas por semana, últimas 8 semanas", warn: ind.atividadesPendentes > 0 },
  ];
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
  const mediaBadge = (id: string, max: string) => itemAvg(id, max);
  const atividadesLista = recentItems.length === 0 ? <p className="empty !py-4">Nenhuma atividade ainda. <Link href="/app/notas">Criar atividade</Link></p> : (
    <ul className="list-rows text-sm">{recentItems.map((i) => { const a = mediaBadge(i.id, i.max); return (
      <li key={i.id}><Link href={`/app/notas?turma=${i.classId}&periodo=${encodeURIComponent(i.period)}`} className="recente-row"><span className="recente-ico" aria-hidden><Icon name="prova" size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-ink">{i.title}</span><span className="hint block truncate">{i.className} · {i.period}</span></span>{a != null && <span className={`badge ${a >= rules.passMark ? "badge-ok" : "badge-amber"}`}>média {a.toLocaleString("pt-BR")}</span>}</Link></li>); })}</ul>);
  const provasLista = recentExams.length === 0 ? <p className="empty !py-4">Nenhuma prova ainda. <Link href="/app/provas/montar">Montar prova</Link></p> : (
    <ul className="list-rows text-sm">{recentExams.map((e) => (
      <li key={e.id}><Link href={`/app/provas/${e.id}`} className="recente-row"><span className="recente-ico" aria-hidden><Icon name="prova" size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-ink">{e.title}</span><span className="hint block truncate">{e.className ?? "Sem turma"} · {fmtDateTime(e.updatedAt)}</span></span><span className="badge badge-gray">{e.status === "draft" ? "Rascunho" : "Aplicada"}</span></Link></li>))}</ul>);
  const mostrarAula = !!lessonNow && !!lessonNow.focus;
  return (
    <div className="space-y-5">
      <div className="inicio-head">
        <div><h1>{greet}, {ctx.user.name.split(" ")[0]}! <span aria-hidden>👋</span></h1><p className="capitalize-first">{today} · {ctx.org.name}{ctx.org.city ? ` · ${ctx.org.city}/${ctx.org.uf}` : ""}</p></div>
        {staffView && <Link className="btn" href="/app/provas/montar" data-testid="criar-prova">+ Criar prova</Link>}
      </div>
      {sp.novo && cls.length > 0 && (
        <section className="card-tint space-y-2" aria-label="Cadastro concluído">
          <p className="font-semibold">Cadastro concluído. Sua turma está pronta.</p>
          <p className="text-sm text-ink-soft">{cls.slice(0, 3).map((c) => `${subjectLabel(c.subject)} · ${c.name}`).join(" · ")}{cls.length > 3 ? ` e mais ${cls.length - 3}` : ""}</p>
          <Link className="btn" href={`/app/provas/nova${sp.turma ? `?turma=${sp.turma}` : ""}`}>Criar minha primeira prova</Link>
        </section>)}
      {staffView && (
        <section aria-label="Indicadores" data-testid="indicadores">
          <ul className="kpi-row">
            {kpis.map((i) => (
              <li key={i.k}>
                <Link href={i.href} className="kpi2" data-testid={`kpi-${i.k}`} data-warn={i.warn ? "1" : undefined} style={{ ["--kc" as string]: i.cor, ["--kt" as string]: i.tint }}>
                  <span className="kpi2-ico" aria-hidden><Icon name={i.icon} size={20} /></span>
                  <span className="kpi2-txt"><span className="kpi2-label"><span className="k-long">{i.label}</span><span className="k-short">{i.curto}</span></span><strong>{i.v}</strong><span className="kpi2-sub">{i.sub}</span></span>
                  <Sparkline valores={i.serie} cor={i.cor} rotulo={i.rot} />
                </Link>
              </li>))}
          </ul>
        </section>)}
      {mostrarAula && <AulaDeAgora ln={lessonNow!} multiOrg={ctx.orgs.length > 1} />}
      {staffView && stepsLeft > 0 && (
        <section className="card" aria-label="Primeiros passos" data-testid="primeiros-passos">
          <div className="section-title"><h2>Primeiros passos</h2><span className="hint">{steps.length - stepsLeft} de {steps.length} concluídos</span></div>
          <div className="pbar mb-3" role="img" aria-label={`${steps.length - stepsLeft} de ${steps.length} passos concluídos`}><i style={{ width: `${((steps.length - stepsLeft) / steps.length) * 100}%` }} /></div>
          <ol className="grid gap-2 sm:grid-cols-2">{steps.map((st, i) => (
            <li key={st.label}><Link href={st.href} className={`flex items-center gap-3 rounded-lg border border-line p-3 no-underline ${st.done ? "opacity-60" : "hover:border-sky"}`}>
              <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-sm font-bold ${st.done ? "bg-[var(--color-ok-tint)] text-ok" : "bg-brand-tint text-brand"}`} aria-hidden>{st.done ? "✓" : i + 1}</span>
              <span className={`font-semibold text-ink ${st.done ? "line-through" : ""}`}>{st.label}</span><span className="sr-only">{st.done ? " (concluído)" : " (pendente)"}</span></Link></li>))}</ol>
        </section>)}
      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <section className="card" aria-label="Desempenho das turmas" data-testid="desempenho">
          <div className="section-title"><h2>{cls.length > 1 ? "Desempenho das turmas" : "Desempenho da turma"}</h2>{periodos.length > 0 && <PeriodoSelect periodos={periodos} atual={periodo} />}</div>
          {mediaGeral == null ? (
            <div className="empty !py-6"><p>{desempenho.titulo}</p><p className="hint mt-1">{desempenho.apoio}</p><p className="mt-3"><Link className="btn btn-sm" href="/app/notas">Lançar notas</Link></p></div>
          ) : (
            <div className="desempenho">
              <div className="desempenho-donut">
                <Donut valor={mediaGeral} rotulo={`Média geral ${mediaGeral.toFixed(1).replace(".", ",")} de 10 em ${periodo}`} />
                <p className="mt-2 font-semibold" data-tom={desempenho.tom}>{desempenho.titulo}</p>
                <p className="hint">{desempenho.apoio}</p>
              </div>
              <div className="desempenho-chart"><AreaChart pontos={pontos} rotulo={`Média por atividade em ${periodo}: ${pontos.map((p) => `${p.nome} ${p.v.toFixed(1).replace(".", ",")}`).join(", ")}`} /></div>
            </div>)}
        </section>
        <section className="card flex flex-col" aria-label="Agenda"><div className="section-title"><h2>Agenda</h2><Link href="/app/agenda">Ver agenda</Link></div>
          {upcoming.length === 0 ? (
            <div className="agenda-vazia">
              <span className="agenda-ico" aria-hidden><Icon name="agenda" size={34} /></span>
              <div><p className="font-semibold">Nada marcado para os próximos dias.</p><p className="hint">Adicione eventos e prazos!</p></div>
              <NovoEvento classes={cls.map((c) => ({ id: c.id, name: c.name }))} canSchool={ctx.org.role === "coordinator" || ctx.org.role === "admin" || ctx.org.kind === "personal"} defaultDate={todayIso} label="+ Novo evento" className="btn btn-ghost btn-sm" testId="novo-evento-inicio" />
            </div>
          ) : (
            <>
              <ul className="space-y-3">{upcoming.map((e) => { const d = spISO(e.start); return (
                <li key={e.key} className="flex items-center gap-3"><span className="date-chip" style={{ ["--c" as string]: CAT_COLOR[e.category] ?? "#64748B" }} aria-hidden>{Number(d.slice(8))}</span>
                  <span className="min-w-0"><span className="block truncate font-semibold">{e.title}</span><span className="hint">{CAT_LABEL[e.category] ?? e.category}{d === todayIso ? " · hoje" : ""}</span></span></li>); })}</ul>
              <div className="mt-auto pt-3"><NovoEvento classes={cls.map((c) => ({ id: c.id, name: c.name }))} canSchool={ctx.org.role === "coordinator" || ctx.org.role === "admin" || ctx.org.kind === "personal"} defaultDate={todayIso} label="+ Novo evento" className="btn btn-ghost btn-sm" testId="novo-evento-inicio" /></div>
            </>)}
        </section>
      </div>
      <RecentesTabs atividades={atividadesLista} provas={provasLista} />
      <div className="hidden gap-5 xl:grid xl:grid-cols-2">
        <section className="card" aria-label="Atividades recentes"><div className="section-title"><h2>Atividades recentes</h2><Link href="/app/notas">Ver todas</Link></div>{atividadesLista}</section>
        <section className="card" aria-label="Provas recentes"><div className="section-title"><h2>Provas recentes</h2><Link href="/app/provas">Ver todas</Link></div>{provasLista}</section>
      </div>
      {attention > 0 && <section className="card" aria-label="Pendências"><h2 className="section-title">Pendências</h2><ul className="list-rows text-sm">{reviews.map((r) => <li key={r.id}>Documento para revisar: <Link href="/app/documentos">{r.title}</Link></li>)}{notes.map((n) => <li key={n.id}>{n.href ? <Link href={n.href}>{n.title}</Link> : n.title}</li>)}</ul></section>}
      {submissions.length > 0 && (
        <section className="card" aria-label="Notas enviadas por QR" data-testid="notas-qr">
          <h2 className="section-title">{ctx.org.role === "coordinator" ? "Notas recebidas dos professores" : "Notas que você enviou à escola"}</h2>
          <ul className="list-rows text-sm">{submissions.map(({ s, student, cls: cn }) => <li key={s.id}><Link href={`/app/turmas/${s.classId}/notas`}>{student}</Link> · {cn} · <strong>{String(Number(s.value)).replace(".", ",")}</strong></li>)}</ul>
        </section>)}
    </div>
  );
}
