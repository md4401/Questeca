import Link from "next/link";
import { and, eq, desc, isNull } from "drizzle-orm";
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
import { loadRadar } from "@/lib/radar";
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
  const radar = ctx.org.role === "admin" ? [] : await loadRadar(ctx);
  const submissions = await db.select({ s: gradeSubmissions, student: studentsT.name, cls: classesT.name }).from(gradeSubmissions)
    .innerJoin(studentsT, eq(studentsT.id, gradeSubmissions.studentId)).innerJoin(classesT, eq(classesT.id, gradeSubmissions.classId))
    .where(and(eq(gradeSubmissions.orgId, ctx.org.id), ctx.org.role === "coordinator" ? undefined : eq(gradeSubmissions.submittedBy, ctx.user.id))).orderBy(desc(gradeSubmissions.submittedAt)).limit(6);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1>Olá, {ctx.user.name.split(" ")[0]}</h1><p className="hint">{ctx.org.name}{ctx.org.city ? ` · ${ctx.org.city}/${ctx.org.uf}` : ""} · {new Date().getFullYear()}</p></div>
        {ctx.org.role !== "admin" && <Link className="btn" href="/app/provas/nova">Criar prova</Link>}
      </div>
      {lessonNow && <AulaDeAgora ln={lessonNow} multiOrg={ctx.orgs.length > 1} />}
      {radar.length > 0 && (
        <section className="card" aria-label="Radar de alunos" data-testid="radar-home">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-lg">Radar de alunos <span className="badge badge-danger align-middle">{radar.length}</span></h2><Link href="/app/radar">Ver todos</Link></div>
          <ul className="space-y-1 text-sm">{radar.slice(0, 4).map((r) => <li key={`${r.classId}:${r.studentId}`}><span className={r.result.level === "alerta" ? "badge badge-danger" : "badge badge-amber"}>{r.result.level === "alerta" ? "Alerta" : "Atenção"}</span> <strong>{r.studentName}</strong> · {r.className} <span className="hint">— {r.result.reasons[0]}</span></li>)}</ul>
        </section>)}
      {submissions.length > 0 && (
        <section className="card" aria-label="Notas enviadas por QR" data-testid="notas-qr">
          <h2 className="mb-2 text-lg">{ctx.org.role === "coordinator" ? "Notas recebidas dos professores" : "Notas que você enviou à escola"}</h2>
          <ul className="space-y-1 text-sm">{submissions.map(({ s, student, cls: cn }) => <li key={s.id}><Link href={`/app/turmas/${s.classId}/notas`}>{student}</Link> · {cn} · <strong>{String(Number(s.value)).replace(".", ",")}</strong>/{String(Number(s.maxPoints)).replace(".", ",")} <span className="hint">({fmtDateTime(s.submittedAt)})</span></li>)}</ul>
        </section>)}
      {sp.novo && cls.length > 0 && (
        <section className="card-tint space-y-2" aria-label="Cadastro concluído">
          <p className="font-semibold">Cadastro concluído. Sua turma está pronta.</p>
          <p className="text-sm text-ink-soft">{cls.slice(0, 3).map((c) => `${subjectLabel(c.subject)} · ${c.name}`).join(" · ")}{cls.length > 3 ? ` e mais ${cls.length - 3}` : ""}</p>
          <Link className="btn" href={`/app/provas/nova${sp.turma ? `?turma=${sp.turma}` : ""}`}>Criar minha primeira prova</Link>
          {cls.some((c) => c.subject !== "matematica") && <p className="hint">O acervo de questões ainda cobre Matemática. As outras disciplinas ficam salvas no seu perfil.</p>}
        </section>)}
      {drafts.length > 0 && <section className="card"><h2 className="mb-2 text-lg">Rascunhos recentes</h2><ul className="space-y-1">{drafts.map((d) => <li key={d.id}><Link href={`/app/provas/${d.id}`}>{d.title}</Link> <span className="hint">· {fmtDateTime(d.updatedAt)}</span></li>)}</ul></section>}
      <section className="card"><h2 className="mb-2 text-lg">Turmas ativas</h2>
        {cls.length === 0 ? <p className="text-ink-soft">Nenhuma turma disponível neste contexto.</p> : <ul className="grid gap-2 md:grid-cols-3">{cls.map((c) => <li key={c.id}><Link href={`/app/turmas/${c.id}`} className="block rounded-lg border border-line p-3 no-underline hover:bg-brand-tint"><strong>{c.name}</strong><br /><span className="hint">{gradeLabel(c.grade)} · {subjectLabel(c.subject)}{c.isDemo ? " · exemplo" : ""}</span></Link></li>)}</ul>}
      </section>
      {(notes.length > 0 || reviews.length > 0) && <section className="card"><h2 className="mb-2 text-lg">Pendências de revisão</h2><ul className="space-y-1 text-sm">{reviews.map((r) => <li key={r.id}>Documento para revisar: <Link href="/app/documentos">{r.title}</Link></li>)}{notes.map((n) => <li key={n.id}>{n.href ? <Link href={n.href}>{n.title}</Link> : n.title}</li>)}</ul></section>}
      <section className="card-tint text-sm">Plano <strong>{PLANS[info.plan].name}</strong>: {info.used.assemblies}/{info.limits.assemblies >= 10000 ? "∞" : info.limits.assemblies} montagens assistidas neste ciclo (renova em {info.cycleEnd.toLocaleDateString("pt-BR", { timeZone: "UTC" })}). <Link href="/app/plano">Ver plano</Link></section>
    </div>
  );
}
