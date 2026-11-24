import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { PageHead } from "@/components/page-head";
import { aiAvailable } from "@/lib/ai";

export const metadata = { title: "Novo quiz" };
export default async function Novo() {
  await requireCtx();
  const ia = aiAvailable();
  return (
    <div className="space-y-4">
      <PageHead icon="quiz" title="Novo quiz" sub="Como você quer criar?" />
      <div className="qchoice">
        <Link href="/app/quiz/novo/manual" className="qchoice-card" data-testid="criar-manual">
          <span className="qchoice-ico" aria-hidden>✎</span>
          <h2>Criar manualmente</h2>
          <p>Monte as perguntas uma a uma, como num formulário: escreva o enunciado, as opções e marque a certa.</p>
          <span className="qchoice-go">Começar →</span>
        </Link>
        {ia ? (
          <Link href="/app/assistente?novo=quiz" className="qchoice-card" data-testid="criar-gizia">
            <span className="qchoice-ico giz" aria-hidden>✦</span>
            <h2>Criar com a GizIA</h2>
            <p>Abre uma conversa nova: a GizIA pergunta sobre a turma e o tema e escreve o quiz. Depois você revisa e ajusta.</p>
            <span className="qchoice-go">Conversar com a GizIA →</span>
          </Link>
        ) : (
          <div className="qchoice-card off"><span className="qchoice-ico giz" aria-hidden>✦</span><h2>Criar com a GizIA</h2><p>A GizIA ainda não está ativada nesta instalação.</p></div>)}
      </div>
    </div>
  );
}
