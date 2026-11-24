import { Form, Field, SubmitButton } from "@/components/form";
import { rulesFrom } from "@/lib/gradebook";
import { saveGradingAction, savePortalSettingsAction } from "./actions";
import type { Ctx } from "@/lib/session";
import { can } from "@/lib/core/permissions";

/** Em contexto pessoal o professor edita as próprias regras; em escola, só quem tem permissão de modelos. */
export const podeEditarRegras = (ctx: Ctx) => ctx.org.kind !== "school" || can(ctx.org.role, "org.templates");

/** Regras de nota da escola/contexto (escala, média, arredondamento, recuperação, períodos). Mostradas na página Notas. */
export function RegrasDeNotaCard({ ctx }: { ctx: Ctx }) {
  const rules = rulesFrom(ctx.org.settings);
  return (
    <section className="card" aria-labelledby="reg">
      <h2 id="reg" className="mb-1 text-lg">Regras de nota</h2>
      <p className="hint mb-3">O cálculo segue as regras confirmadas e mostra a origem dos valores.</p>
      <Form action={saveGradingAction}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Escala máxima" name="scaleMax" type="number" step="any" defaultValue={rules.scaleMax} />
          <Field label="Média de aprovação" name="passMark" type="number" step="any" defaultValue={rules.passMark} />
          <div className="field"><label htmlFor="rounding">Arredondamento</label><select id="rounding" name="rounding" defaultValue={rules.rounding} className="input"><option value="none">Sem arredondar</option><option value="tenth">Décimos</option><option value="half">Meio ponto</option><option value="up_half">Meio ponto para cima</option></select></div>
          <div className="field"><label htmlFor="recovery">Recuperação</label><select id="recovery" name="recovery" defaultValue={rules.recovery} className="input"><option value="none">Nenhuma</option><option value="replace_if_higher">Substitui se maior</option><option value="average">Média com a original</option><option value="independent">Atividade independente</option></select></div>
          <div className="field"><label htmlFor="absenceCounts">Ausência na prova</label><select id="absenceCounts" name="absenceCounts" defaultValue={rules.absenceCounts} className="input"><option value="exclude">Não conta na média</option><option value="zero">Conta como zero</option></select></div>
          <div className="field"><label htmlFor="notDeliveredCounts">Falta de entrega</label><select id="notDeliveredCounts" name="notDeliveredCounts" defaultValue={rules.notDeliveredCounts} className="input"><option value="zero">Conta como zero</option><option value="exclude">Não conta na média</option></select></div>
          <div className="md:col-span-2"><Field label="Períodos (separados por vírgula)" name="periods" defaultValue={rules.periods.join(", ")} /></div>
        </div>
        <SubmitButton>Salvar regras</SubmitButton>
      </Form>
    </section>
  );
}

/** Limites do painel pedagógico (frequência e média mínimas). Mostrados na página Frequência. */
export function PainelPedagogicoCard({ ctx }: { ctx: Ctx }) {
  const rules = rulesFrom(ctx.org.settings);
  const risk = ctx.org.settings.risk;
  return (
    <section className="card" aria-labelledby="portal">
      <h2 id="portal" className="mb-1 text-lg">Painel pedagógico</h2>
      <p className="hint mb-3">Limites que acendem os sinais de atenção. São apoio ao professor e à coordenação, nunca diagnóstico.</p>
      <Form action={savePortalSettingsAction}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Frequência mínima (%)" name="minAttendance" type="number" step="any" defaultValue={risk?.minAttendance ?? 75} /><Field label="Média mínima" name="minAverage" type="number" step="any" defaultValue={risk?.minAverage ?? rules.passMark} /></div>
        <SubmitButton>Salvar regras do painel</SubmitButton>
      </Form>
    </section>
  );
}
