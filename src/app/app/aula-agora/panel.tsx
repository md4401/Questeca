import Link from "next/link";
import type { loadLessonNow } from "@/lib/lesson-now";
import { Form, SubmitButton } from "@/components/form";
import { quickAttendanceAction } from "./actions";
import { subjectLabel } from "@/lib/taxonomy";
import { WEEKDAY } from "@/lib/core/calendar";

type LN = NonNullable<Awaited<ReturnType<typeof loadLessonNow>>>;

export function AulaDeAgora({ ln, multiOrg }: { ln: LN; multiOrg: boolean }) {
  const f = ln.focus;
  if (!f || !("roster" in ln)) {
    return <section className="card" aria-label="Aula de agora" data-testid="aula-agora"><h2>Aula de agora</h2><p className="mt-1 text-ink-soft">{ln.agenda.length ? "Suas aulas de hoje já terminaram." : `Sem aulas na ${WEEKDAY[ln.weekday]?.toLowerCase() ?? "agenda"} segundo a grade de horários.`} <Link href="/app/horarios">Grade de horários</Link></p></section>;
  }
  const plan = ln.plan ?? ln.fallbackPlan;
  return (
    <section className="card" aria-label="Aula de agora" data-testid="aula-agora">
      <div className="mb-1 flex flex-wrap items-center gap-2"><span className={`badge ${ln.isCurrent ? "badge-ok" : ""}`}>{ln.isCurrent ? "Aula de agora" : "Próxima aula"}</span><span className="hint">{f.slot.startTime}–{f.slot.endTime}{f.slot.room ? ` · sala ${f.slot.room}` : ""}</span></div>
      <h2 className="text-xl">{subjectLabel(f.slot.subject)} · {f.cls.name}{multiOrg ? <span className="badge badge-gray ml-2 align-middle">{f.cls.orgName}</span> : null}</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-ink-soft">Plano desta aula</h3>
          {plan ? <p className="text-sm"><Link href={`/app/planos-de-aula/${plan.id}`}><strong>{plan.theme}</strong></Link>{ln.plan ? "" : <span className="hint"> · plano mais recente da turma</span>}</p>
            : <p className="text-sm text-ink-soft">Nenhum plano ainda. <Link href={`/app/planos-de-aula?turma=${f.cls.id}&data=${ln.dateISO}`}>Gerar plano em segundos</Link></p>}
          <p className="mt-2 text-sm"><Link href={`/app/turmas/${f.cls.id}`}>Abrir turma</Link> · <Link href={`/app/turmas/${f.cls.id}/observacoes`}>Registrar observação</Link></p>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-ink-soft">Chamada</h3>
          {ln.roster.length === 0 ? <p className="text-sm text-ink-soft">Turma sem alunos. <Link href={`/app/turmas/${f.cls.id}/alunos`}>Adicionar alunos</Link></p>
            : ln.taken ? <p className="text-sm" data-testid="chamada-feita">Chamada registrada: {ln.roster.length - ln.absent.size} presente(s), {ln.absent.size} falta(s). <Link href={`/app/turmas/${f.cls.id}/frequencia?data=${ln.dateISO}&aula=${encodeURIComponent(f.slot.startTime)}`}>Corrigir</Link></p>
            : (
              <Form action={quickAttendanceAction.bind(null, f.cls.id, f.slot.startTime)} toast>
                <p className="hint mb-1">Todos começam presentes. Marque só quem faltou.</p>
                <ul className="max-h-60 divide-y divide-line overflow-auto">{ln.roster.map((s) => (
                  <li key={s.id}><label className="flex cursor-pointer items-center justify-between gap-2 py-1.5"><span>{s.name}</span><span className="flex items-center gap-1 text-sm"><input type="checkbox" name="absent" value={s.id} aria-label={`Falta: ${s.name}`} />Falta</span></label></li>))}</ul>
                <div className="mt-2"><SubmitButton pendingLabel="Salvando…">Salvar chamada</SubmitButton></div>
              </Form>)}
        </div>
      </div>
      {ln.agenda.length > 1 && <p className="mt-3 text-sm text-ink-soft">Hoje: {ln.agenda.map((a) => `${a.slot.startTime} ${a.cls.name}${multiOrg ? ` (${a.cls.orgName})` : ""}`).join(" · ")}</p>}
    </section>
  );
}
