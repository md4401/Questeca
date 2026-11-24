import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendanceSessions, attendanceRecords, attendanceChanges, users } from "@/db/schema";
import type { Ctx } from "@/lib/session";
import { classStudents } from "@/lib/access";
import { SubmitButton } from "@/components/form";
import { ChamadaModal, ChamadaForm } from "@/components/chamada-modal";
import { saveAttendanceAction } from "@/app/app/turmas/[id]/frequencia/actions";
import { summarize, isLow, ATT_LABEL, DEFAULT_MIN_PCT } from "@/lib/core/attendance";
import { todayISO, fmtDate, fmtDateTime } from "@/lib/format";

/** Chamada e frequência de uma turma. Usado em /app/frequencia e em /app/turmas/[id]/frequencia. `hidden` mantém parâmetros (ex.: turma) ao abrir outra data. */
export async function FrequenciaPanel({ ctx, cls, sp, hidden = {} }: { ctx: Ctx; cls: { id: string; name: string }; sp: { data?: string; aula?: string }; hidden?: Record<string, string> }) {
  const id = cls.id;
  const minPct = ctx.org.settings.risk?.minAttendance ?? DEFAULT_MIN_PCT;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") ? sp.data! : todayISO();
  const lesson = (sp.aula ?? "").slice(0, 40);
  const roster = await classStudents(id);
  const [sess] = await db.select().from(attendanceSessions).where(and(eq(attendanceSessions.classId, id), eq(attendanceSessions.date, date), eq(attendanceSessions.lesson, lesson))).limit(1);
  const recs = sess ? await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, sess.id)) : [];
  const cur = new Map(recs.map((r) => [r.studentId, r]));
  const allSessions = await db.select({ id: attendanceSessions.id, date: attendanceSessions.date, lesson: attendanceSessions.lesson }).from(attendanceSessions).where(eq(attendanceSessions.classId, id)).orderBy(desc(attendanceSessions.date));
  const allRecs = allSessions.length ? await db.select().from(attendanceRecords).where(inArray(attendanceRecords.sessionId, allSessions.map((s) => s.id))) : [];
  const history = sess ? await db.select({ c: attendanceChanges, who: users.name }).from(attendanceChanges).innerJoin(users, eq(users.id, attendanceChanges.changedBy)).where(eq(attendanceChanges.sessionId, sess.id)).orderBy(desc(attendanceChanges.createdAt)) : [];
  const nameOf = (sid: string) => roster.find((s) => s.id === sid)?.name ?? "—";
  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg">Chamada</h2><p className="hint">{sess ? `Chamada de ${fmtDate(date)} registrada.` : `Nenhuma chamada em ${fmtDate(date)} ainda.`} {cls.name}</p></div>
        {roster.length === 0 && <p className="text-ink-soft">Cadastre alunos para fazer a chamada.</p>}
        {roster.length > 0 && <ChamadaModal label={sess ? "Ver ou corrigir chamada" : "Fazer chamada"} titulo={`Chamada · ${cls.name}`} abrirInicial={!!(sp.data || sp.aula)}>
        <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="field !mb-0"><label htmlFor="data">Data</label><input id="data" name="data" type="date" max={todayISO()} defaultValue={date} className="input" /></div>
          <div className="field !mb-0"><label htmlFor="aula">Aula (opcional)</label><input id="aula" name="aula" defaultValue={lesson} className="input" placeholder="1ª aula" /></div>
          <button className="btn btn-ghost" type="submit">Abrir</button>
        </form>
        {roster.length === 0 ? <p className="text-ink-soft">Cadastre alunos para fazer a chamada.</p> : (
          <ChamadaForm action={saveAttendanceAction.bind(null, id)}>
            <input type="hidden" name="date" value={date} /><input type="hidden" name="lesson" value={lesson} />
            <p className="hint mb-2">{sess ? `Chamada de ${fmtDate(date)} já registrada. Alterações exigem o motivo da correção.` : `Nova chamada de ${fmtDate(date)} · ${cls.name}. Quem ficar sem marcação não conta como falta.`}</p>
            <ul className="chamada-list">
              {roster.map((s) => {
                const c = cur.get(s.id)?.status ?? (sess ? "" : "present");
                return (
                  <li key={s.id} className="chamada-row">
                    <fieldset className="chamada-fs"><legend className="chamada-nome"><span className="chamada-av" aria-hidden>{s.name.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("")}</span>{s.name}</legend>
                      <span className="chamada-ops">
                        {(["present", "absent", "justified"] as const).map((st) => {
                          const full = ATT_LABEL[st].replace("Falta justificada", "Justificada");
                          return <label key={st} className="chamada-op" data-st={st}><input className="sr-only" type="radio" name={`st_${s.id}`} value={st} defaultChecked={c === st} aria-label={`${ATT_LABEL[st]}: ${s.name}`} /><span className="full">{full}</span><span className="short" aria-hidden>{st === "present" ? "P" : st === "absent" ? "F" : "J"}</span></label>;
                        })}
                      </span></fieldset>
                  </li>);
              })}
            </ul>
            {sess && <div className="field mt-3"><label htmlFor="reason">Motivo da correção</label><input id="reason" name="reason" className="input" placeholder="Ex.: aluno chegou após a chamada" /></div>}
            <div className="chamada-save"><SubmitButton pendingLabel="Salvando…">{sess ? "Salvar correção" : "Salvar chamada"}</SubmitButton></div>
          </ChamadaForm>)}
        {history.length > 0 && (<details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-brand">Histórico de correções ({history.length})</summary>
          <ul className="mt-2 space-y-1">{history.map(({ c, who }) => <li key={c.id}>{nameOf(c.studentId)}: {ATT_LABEL[(c.before ?? "present") as keyof typeof ATT_LABEL]} → <strong>{ATT_LABEL[c.after as keyof typeof ATT_LABEL]}</strong> · {c.reason} <span className="hint">({who}, {fmtDateTime(c.createdAt)})</span></li>)}</ul></details>)}
      </ChamadaModal>}
      </section>
      <section className="card">
        <h2 className="mb-1 text-lg">Frequência da turma</h2>
        <p className="hint mb-3">{allSessions.length} chamada(s) registrada(s). Percentual = presenças ÷ chamadas registradas; falta justificada não conta como presença. Alerta abaixo de {minPct}%.</p>
        {roster.length === 0 || allSessions.length === 0 ? <p className="text-ink-soft">Sem dados ainda.</p> : (
          <ul className="space-y-2.5">
            {roster.map((s) => { const sm = summarize(allRecs.filter((r) => r.studentId === s.id)); const low = isLow(sm.pct, minPct); const pct = sm.pct == null ? 0 : Math.round(sm.pct);
              return (
                <li key={s.id} className="rounded-xl border border-line p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3"><span className="avatar" aria-hidden>{s.name.trim().slice(0, 1).toUpperCase()}</span><div><p className="font-semibold">{s.name}</p><p className="hint">{sm.present} presente(s) · {sm.absent} falta(s) · {sm.justified} justificada(s)</p></div></div>
                    <div className="flex items-center gap-2">{low && <span className="chip-status" data-s="atencao">⚠ abaixo do mínimo</span>}<span className={`chip-status ${low ? "" : ""}`} data-s={sm.pct == null ? "regular" : low ? "risco" : "regular"}>{sm.pct == null ? "—" : `${String(sm.pct).replace(".", ",")}%`}</span></div>
                  </div>
                  <div className="pbar mt-2.5" data-tone={sm.pct == null ? undefined : low ? "danger" : sm.pct < 85 ? "amber" : undefined} role="img" aria-label={`Frequência de ${s.name}: ${sm.pct == null ? "sem dados" : `${pct}%`}`}><i style={{ width: `${pct}%` }} /></div>
                </li>); })}
          </ul>)}
      </section>
    </div>
  );
}
