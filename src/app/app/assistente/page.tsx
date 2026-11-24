import { requireCtx } from "@/lib/session";
import { aiAvailable } from "@/lib/ai";
import { PageHead } from "@/components/page-head";
import { creditosHoje } from "@/lib/credits";
import { listarSessoes, sessaoDoUsuario, mensagensDaSessao } from "@/lib/assistente/sessoes";
import { Assistente } from "@/components/assistente";

export const metadata = { title: "Assistente IA" };

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const sessoes = await listarSessoes(ctx.user.id);
  const ativaRow = sp.s ? await sessaoDoUsuario(ctx.user.id, sp.s) : null;
  const ativa = ativaRow ? { id: ativaRow.id, title: ativaRow.title, mensagens: (await mensagensDaSessao(ativaRow.id)).map((m) => ({ ...m, links: m.links ?? [] })) } : null;
  const cred = await creditosHoje(ctx.user.id);
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHead icon="assistente" title="Assistente IA" sub="Peça uma prova, um plano de aula ou uma apresentação. Ele usa as suas turmas, notas e o banco de questões." />
      <Assistente disponivel={aiAvailable()} nome={ctx.user.name.split(" ")[0]} creditos={cred} sessoes={sessoes.map((x) => ({ ...x, updatedAt: x.updatedAt.toISOString() }))} ativa={ativa as never} />
      <p className="hint">O assistente só enxerga os seus dados (suas turmas, notas, provas e planos) e só cria rascunhos que você edita. Cada 1.000 tokens usados gastam 1 crédito (limite diário de créditos, renovado à meia-noite). Para responder, os dados necessários da conversa são enviados ao provedor de IA configurado.</p>
    </div>
  );
}
