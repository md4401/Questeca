import Link from "next/link";
import { PLANS, brl } from "@/lib/core/plans";

export const metadata = { title: "Planos" };

export default function Planos() {
  const rows: [string, (p: (typeof PLANS)[keyof typeof PLANS]) => string][] = [
    ["Montagens assistidas por ciclo", (p) => (p.assemblies >= 10000 ? "Conforme contrato" : String(p.assemblies))],
    ["Turmas ativas", (p) => (p.classes >= 10000 ? "Conforme contrato" : String(p.classes))],
    ["Correção de cartões por ciclo", (p) => (p.cards >= 100000 ? "Volume contratado" : String(p.cards))],
    ["PDF do aluno, gabarito, notas e CSV", () => "Sim"],
    ["Word editável, segunda chamada e importação por foto", (p) => (p.features.word ? "Sim" : "Não")],
    ["Relatórios avançados", (p) => (p.features.advancedReports ? "Sim" : "Não")],
  ];
  const order = ["free", "teacher", "school"] as const;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1>Planos e limites</h1>
      <p className="mt-2 text-ink-soft">Proposta comercial em fase de validação com professores e escolas. Valores e limites podem ser ajustados após o piloto.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {order.map((id) => {
          const p = PLANS[id];
          return (
            <section key={id} className="card flex flex-col" aria-labelledby={`p-${id}`}>
              <h2 id={`p-${id}`}>{p.name}</h2>
              <p className="mt-1 text-3xl font-bold">{p.priceCents === null ? "Sob proposta" : p.priceCents === 0 ? "R$ 0" : <>{brl(p.priceCents)}<span className="text-base font-normal text-ink-soft">/mês</span></>}</p>
              <p className="mt-1 text-sm text-ink-soft">{p.blurb}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {rows.map(([label, fn]) => <li key={label}><span className="font-semibold">{label}:</span> {fn(p)}</li>)}
              </ul>
              <div className="mt-5">
                {id === "school" ? <Link className="btn btn-ghost w-full" href="/escolas#demonstracao">Solicitar demonstração</Link> : <Link className="btn w-full" href="/criar-conta">{id === "free" ? "Começar grátis" : "Criar conta e assinar"}</Link>}
              </div>
            </section>
          );
        })}
      </div>
      <div className="card mt-8 text-sm">
        <h3>Como contamos o uso</h3>
        <p className="mt-1">Uma montagem assistida é contada na primeira gravação bem-sucedida do rascunho de uma nova avaliação com ao menos um item elegível. Revisar, trocar, salvar ou exportar de novo a mesma prova não consome outra. Uma segunda chamada montada pelo acervo é uma nova avaliação. Cada cartão distinto com leitura utilizável conta uma vez. Falhas e reenvios da mesma folha não duplicam o consumo. Ao atingir o limite, você mantém a revisão, o lançamento manual e a exportação dos seus dados.</p>
      </div>
    </div>
  );
}
