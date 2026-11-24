import { requireCtx } from "@/lib/session";
import { aiAvailable } from "@/lib/ai";
import { creditosHoje } from "@/lib/credits";
import { listarSessoes, sessaoDoUsuario, mensagensDaSessao, paraTela } from "@/lib/assistente/sessoes";
import { Assistente } from "@/components/assistente";

export const metadata = { title: "GizIA" };

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const sessoes = await listarSessoes(ctx.user.id);
  const ativaRow = sp.s ? await sessaoDoUsuario(ctx.user.id, sp.s) : null;
  const ativa = ativaRow ? { id: ativaRow.id, title: ativaRow.title, mensagens: (await mensagensDaSessao(ativaRow.id)).map((m) => ({ ...paraTela(m), links: m.links ?? [] })) } : null;
  const cred = await creditosHoje(ctx.user.id);
  return <Assistente disponivel={aiAvailable()} nome={ctx.user.name.split(" ")[0]} creditos={cred} sessoes={sessoes.map((x) => ({ ...x, updatedAt: x.updatedAt.toISOString() }))} ativa={ativa as never} />;
}
