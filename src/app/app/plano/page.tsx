import Link from "next/link";
import { eq, desc, and } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { planInfo } from "@/lib/billing";
import { PLANS, brl } from "@/lib/core/plans";
import { providerName } from "@/lib/billing-provider";
import { db } from "@/db";
import { invoices, classes } from "@/db/schema";
import { checkoutAction, cancelAction, reactivateAction, requestContractAction, archiveForLimitAction } from "./actions";
import { fmtDate } from "@/lib/format";
import { can } from "@/lib/core/permissions";
import { visibleClasses } from "@/lib/access";

export const metadata = { title: "Plano e cobrança" };

export default async function Plano({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; cancel?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const info = await planInfo(ctx.org.id);
  const inv = await db.select().from(invoices).where(eq(invoices.orgId, ctx.org.id)).orderBy(desc(invoices.createdAt)).limit(10);
  const canBill = ctx.org.kind === "personal" || can(ctx.org.role, "org.billing");
  const prov = providerName();
  const sub = info.sub;
  const cls = await visibleClasses(ctx);
  const overLimit = info.used.classes > info.limits.classes;
  void classes; void and;
  const pct = (u: number, l: number) => Math.min(100, Math.round((u / Math.max(1, l)) * 100));
  const bar = (label: string, u: number, l: number) => (
    <div className="mb-3"><div className="flex justify-between text-sm"><span>{label}</span><span>{u} / {l >= 10000 ? "∞" : l}</span></div><div className="h-2 rounded bg-line" role="progressbar" aria-label={label} aria-valuenow={u} aria-valuemax={l}><div className="h-2 rounded bg-brand" style={{ width: `${pct(u, l)}%` }} /></div></div>);
  return (
    <div className="max-w-3xl space-y-6">
      <h1>Plano e cobrança</h1>
      {sp.erro && <p className="card-danger" role="alert">{sp.erro}</p>}
      {sp.ok && <p className="card-tint" role="status">{sp.ok === "1" ? "Pagamento recebido. Seus benefícios serão ativados assim que confirmados." : sp.ok}</p>}
      {sp.cancel && <p className="card-amber">Contratação cancelada. Nada foi cobrado.</p>}
      {sub.status === "past_due" && <p className="card-danger" role="alert">Houve falha no pagamento. Você mantém os benefícios até {fmtDate(sub.graceUntil)}; atualize o pagamento para não voltar ao plano gratuito.</p>}
      <section className="card">
        <h2 className="mb-1 text-lg">Plano atual: {PLANS[info.plan].name}</h2>
        <p className="hint mb-3">{info.plan === "free" ? "Sem cobrança." : `Ciclo atual de ${fmtDate(info.cycleStart)} a ${fmtDate(info.cycleEnd)} · vigente até ${fmtDate(sub.periodEnd)}`}{sub.cancelAtPeriodEnd && ` · cancelamento efetivo em ${fmtDate(sub.periodEnd)} (acesso até lá)`}</p>
        {bar("Montagens assistidas neste ciclo", info.used.assemblies, info.limits.assemblies)}
        {bar("Cartões corrigidos neste ciclo", info.used.cards, info.limits.cards)}
        {bar("Turmas ativas", info.used.classes, info.limits.classes)}
        <p className="hint">Renovação do ciclo de uso: {fmtDate(info.cycleEnd)}. Ao atingir um limite, você mantém a revisão do histórico, o lançamento manual e a exportação dos dados permitidos.</p>
      </section>
      {overLimit && (
        <section className="card-amber"><h2 className="mb-1 text-lg">Turmas acima do limite do plano</h2><p className="text-sm">Seu plano permite {info.limits.classes} turma(s) ativa(s). Escolha quais arquivar; o histórico continua consultável e exportável.</p>
          <ul className="mt-2 space-y-1 text-sm">{cls.map((c) => <li key={c.id} className="flex items-center justify-between"><span>{c.name}</span><form action={archiveForLimitAction.bind(null, c.id)}><button className="link-btn" type="submit">Arquivar</button></form></li>)}</ul></section>)}
      {canBill && ctx.org.kind === "personal" && (
        <section className="card">
          <h2 className="mb-2 text-lg">Contratar ou mudar de plano</h2>
          {info.plan === "teacher" ? (
            <div className="space-y-3"><p className="text-sm">Você está no plano Professor ({brl(PLANS.teacher.priceCents!)}/mês). Cancelando, os benefícios continuam até o fim do ciclo pago e depois você volta ao plano gratuito (1 turma ativa; 3 montagens; sem Word/segunda chamada). O histórico continua consultável e exportável.</p>
              {sub.cancelAtPeriodEnd ? <form action={reactivateAction}><button className="btn" type="submit">Reativar assinatura</button></form> : <form action={cancelAction}><button className="btn btn-ghost" type="submit">Cancelar assinatura</button></form>}</div>
          ) : (
            <div><p className="text-sm">Plano <strong>Professor</strong>: {brl(PLANS.teacher.priceCents!)}/mês, cobrança mensal recorrente, renovação automática. Inclui 30 montagens/ciclo, até 12 turmas, 350 cartões/ciclo, Word editável, segunda chamada, importação por foto e relatórios avançados. Cancelamento a qualquer momento em Plano e cobrança; você mantém o acesso até o fim do ciclo pago.</p>
              {prov === "none" ? (
                <form action={requestContractAction} className="mt-3"><p className="hint mb-2">O pagamento online ainda não está ativo neste ambiente. Registre o interesse e avisaremos.</p><button className="btn" type="submit">Solicitar contratação</button></form>
              ) : (
                <form action={checkoutAction} className="mt-3"><button className="btn" type="submit">Contratar plano Professor</button></form>)}</div>)}
        </section>)}
      {ctx.org.kind === "school" && <section className="card"><h2 className="mb-2 text-lg">Contrato escolar</h2><p className="text-sm">Demonstração, proposta, aceite, licenças, faturamento acordado e renovação são tratados por contrato. {canBill ? "Fale com a Questeca para ajustar licenças." : "Somente o responsável autorizado administra a cobrança e alterações comerciais."}</p>{canBill && <form action={requestContractAction} className="mt-2"><button className="btn btn-ghost" type="submit">Solicitar ajuste de contrato</button></form>}</section>}
      <section className="card"><h2 className="mb-2 text-lg">Histórico de cobranças</h2>{inv.length === 0 ? <p className="text-sm text-ink-soft">Nenhuma cobrança.</p> : <table className="t"><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Situação</th></tr></thead><tbody>{inv.map((i) => <tr key={i.id}><td>{fmtDate(i.createdAt)}</td><td>{i.description}</td><td>{brl(i.amountCents)}</td><td><span className={`badge ${i.status === "paid" ? "" : "badge-danger"}`}>{i.status === "paid" ? "paga" : i.status === "failed" ? "falhou" : "aberta"}</span></td></tr>)}</tbody></table>}</section>
      <p className="hint">Dúvidas sobre cobrança? <Link href="/ajuda#contato">Fale com o suporte</Link>.</p>
    </div>
  );
}
