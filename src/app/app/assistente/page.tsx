import { requireCtx } from "@/lib/session";
import { aiAvailable } from "@/lib/ai";
import { PageHead } from "@/components/page-head";
import { creditosHoje } from "@/lib/credits";
import { Assistente } from "@/components/assistente";

export const metadata = { title: "Assistente IA" };

export default async function Page() {
  const ctx = await requireCtx();
  const cred = await creditosHoje(ctx.user.id);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHead icon="assistente" title="Assistente IA" sub="Peça uma prova, um plano de aula ou uma apresentação. Ele usa as suas turmas, notas e o banco de questões." />
      <Assistente disponivel={aiAvailable()} nome={ctx.user.name.split(" ")[0]} creditos={cred} />
      <p className="hint">O assistente só enxerga os seus dados (suas turmas, notas, provas e planos) e só cria rascunhos que você edita. Cada 1.000 tokens usados gastam 1 crédito (limite diário de créditos, renovado à meia-noite). Para responder, os dados necessários da conversa são enviados ao provedor de IA configurado.</p>
    </div>
  );
}
