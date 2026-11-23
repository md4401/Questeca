import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { loadRadar } from "@/lib/radar";
import { Form, SubmitButton } from "@/components/form";
import { alertCoordinationAction } from "./actions";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Radar de alunos" };

export default async function Radar() {
  const ctx = await requireCtx();
  const rows = await loadRadar(ctx);
  const multi = new Set(rows.map((r) => r.orgId)).size > 1 || ctx.orgs.length > 1;
  return (
    <div className="space-y-4">
      <div><h1>Radar de alunos</h1><p className="hint">Quem teve queda brusca de nota, faltas seguidas ou frequência baixa. É um apoio à sua decisão: confirme com a turma antes de agir. Os limites seguem as regras da escola.</p></div>
      {rows.length === 0 ? <section className="card"><p>Nenhum aluno em atenção agora. 🎉</p></section> : (
        <ul className="space-y-3" aria-label="Alunos em atenção">
          {rows.map((r) => (
            <li key={`${r.classId}:${r.studentId}`} className={r.result.level === "alerta" ? "card-danger" : "card-amber"} data-testid="radar-row">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold"><Link href={`/app/turmas/${r.classId}/frequencia`}>{r.studentName}</Link> <span className={`badge ${r.result.level === "alerta" ? "badge-danger" : "badge-amber"}`}>{r.result.level === "alerta" ? "Alerta" : "Atenção"}</span></p>
                  <p className="hint">{r.className}{multi ? ` · ${r.orgName}` : ""}</p>
                  <ul className="mt-1 list-disc pl-5 text-sm">{r.result.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                <div className="min-w-[14rem]">
                  {r.alertedAt && <p className="hint mb-1">Coordenação avisada em {fmtDate(r.alertedAt)}</p>}
                  <Form action={alertCoordinationAction.bind(null, r.classId, r.studentId)} toast>
                    <label className="sr-only" htmlFor={`n-${r.studentId}`}>Observação para a coordenação</label>
                    <input id={`n-${r.studentId}`} name="note" className="input mb-2" placeholder="Observação (opcional)" maxLength={300} />
                    <SubmitButton className="btn btn-sm" pendingLabel="Avisando…">{r.alertedAt ? "Avisar de novo" : "Avisar coordenação"}</SubmitButton>
                  </Form>
                </div>
              </div>
            </li>))}
        </ul>)}
    </div>
  );
}
