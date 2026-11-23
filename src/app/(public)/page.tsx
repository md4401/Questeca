import Link from "next/link";
import { HeroFilter } from "@/components/landing/hero-filter";
import { DemoButton } from "@/components/landing/demo-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { PLANS, brl } from "@/lib/core/plans";

const FAQ: [string, string][] = [
  ["De onde vêm as questões?", "De provas públicas e de acervos autorizados. Cada item mostra banca, edição, caderno, número e gabarito oficial. Itens cujo direito cobre só a consulta aparecem com o link da fonte e não entram na prova."],
  ["A IA cria questões?", "Não. A IA lê o que você ensinou, classifica e explica a escolha. A prova é montada exclusivamente com questões existentes."],
  ["Preciso cadastrar alunos para começar?", "Não. Você cria a turma, monta a prova e exporta o PDF sem lista nominal. Os alunos entram quando você for lançar notas."],
  ["Funciona com o modelo da minha escola?", "Sim. A coordenação cadastra o cabeçalho, o logo autorizado e as regras de nota uma vez, e todas as provas seguintes já saem no padrão."],
  ["E os dados dos alunos?", "Ficam restritos à turma e à escola, com acesso por papel. Notas e fotos não podem ser publicadas na comunidade, e documentos de aula e dados de estudantes não são usados para treinar modelos."],
];

const STEPS: [string, string][] = [
  ["Diga o que a turma estudou", "Cole suas anotações, envie o PDF da apostila ou use o diário da turma. Você confirma o que vai cair e o que ainda não ensinou."],
  ["Revise um rascunho explicado", "A prova usa só questões reais e mostra por que cada uma foi escolhida. Troque, fixe e reordene."],
  ["Baixe a prova e o gabarito", "A folha do aluno sai com o cabeçalho da escola; o gabarito do professor vai em outro arquivo."],
  ["Corrija e decida a próxima aula", "Lance as respostas pela grade, planilha ou foto do cartão. O acerto por conteúdo indica o que retomar."],
];

const FEATURE_GROUPS: { title: string; items: [string, string][] }[] = [
  { title: "Preparar a prova", items: [
    ["Segunda chamada", "Outra versão com as mesmas habilidades, pontos e tempo, com itens diferentes e sem variantes da questão original."],
    ["Troca entre professores", "Mural geral ou da escola, com moderação. Dados de alunos são bloqueados antes de publicar."],
  ] },
  { title: "Aplicar e corrigir", items: [
    ["Aplicação digital por link", "Cada estudante responde pelo próprio link, uma única vez, sem criar conta. As respostas chegam corrigidas."],
    ["Cartão-resposta por foto", "Fotografe pelo celular. Leituras duvidosas ficam ao lado da imagem para você confirmar; nada entra na nota sozinho."],
    ["Média com a fórmula à vista", "Pesos, ausências, recuperação e arredondamento seguem a regra da escola. Zero, falta e pendente nunca se confundem."],
  ] },
  { title: "Acompanhar a turma", items: [
    ["Próxima aula com questões reais", "O acerto por conteúdo aponta o que retomar e a Questeca separa itens do acervo para prática e checagem."],
    ["Documentos no modelo da escola", "Diário, relatório individual e conselho de classe a partir do que você registrou. O que não tem evidência fica em aberto."],
  ] },
];

export default function Home() {
  const order = ["free", "teacher", "school"] as const;
  return (
    <>
      {/* Primeira tela: título, uma frase e um botão */}
      <section className="border-b border-line bg-white pb-10 pt-8 md:pb-16 md:pt-14">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 md:grid-cols-[1fr_1fr] md:gap-12">
          <div>
            <h1 className="text-[2rem] font-extrabold leading-[1.1] tracking-tight md:text-5xl">Crie provas com o que sua turma estudou</h1>
            <p className="mt-4 max-w-xl text-base text-ink-soft md:text-lg">Revise questões reais e baixe a prova com o gabarito separado.</p>
            <div className="mt-6"><Link className="btn btn-lg w-full sm:w-auto" href="/criar-conta">Criar minha primeira prova</Link></div>
            <p className="mt-3 text-base text-ink-soft">Grátis para começar. Sem cartão de crédito e sem cadastrar alunos.</p>
          </div>
          <HeroFilter />
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="mx-auto mt-14 max-w-6xl scroll-mt-24 px-4">
        <h2 className="text-2xl md:text-3xl">Como funciona</h2>
        <ol className="mt-5 grid gap-3 md:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="card"><span className="badge">Passo {i + 1}</span><h3 className="mt-2">{t}</h3><p className="mt-1 text-base text-ink-soft">{d}</p></li>))}
        </ol>
      </section>

      {/* Recursos por tarefa */}
      <section id="recursos" className="mx-auto mt-14 max-w-6xl scroll-mt-24 px-4">
        <h2 className="text-2xl md:text-3xl">Recursos</h2>
        <p className="mt-1 text-ink-soft">Toque em um recurso para ver os detalhes.</p>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          {FEATURE_GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">{g.title}</h3>
              <div className="space-y-2">
                {g.items.map(([t, d]) => (
                  <details key={t} className="card group !p-0 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold">{t}<span aria-hidden className="text-brand transition-transform group-open:rotate-45">+</span></summary>
                    <p className="px-4 pb-4 text-base text-ink-soft">{d}</p>
                  </details>))}
              </div>
            </div>))}
        </div>
      </section>

      {/* Confiança */}
      <section aria-labelledby="confianca" className="mx-auto mt-14 max-w-6xl px-4">
        <h2 id="confianca" className="text-2xl md:text-3xl">A IA escolhe e explica. Nunca inventa questão.</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ["Origem verificável", "Banca, edição, caderno, número e página de cada item, com o gabarito oficial da versão aplicada."],
            ["Direito de uso por item", "Cada questão tem um estado: em curadoria, só referência, liberada, em revisão ou bloqueada. Só as liberadas entram na prova."],
            ["Dados da turma protegidos", "Acesso por escola, turma e papel. Notas, fotos e observações são privadas e não treinam modelos de IA."],
          ].map(([t, d]) => (<div key={t} className="card"><h3>{t}</h3><p className="mt-1 text-base text-ink-soft">{d}</p></div>))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" aria-labelledby="planos-h" className="mx-auto mt-14 max-w-6xl scroll-mt-24 px-4">
        <h2 id="planos-h" className="text-2xl md:text-3xl">Planos</h2>
        <p className="mt-1 text-ink-soft">Comece grátis e cresça quando a rotina pedir. Valores em fase de validação com professores e escolas.</p>
        <div className="mt-5 grid items-stretch gap-4 md:grid-cols-3">
          {order.map((id) => {
            const p = PLANS[id];
            const featured = id === "teacher";
            return (
              <article key={id} aria-labelledby={`plan-${id}`} className={`card flex flex-col ${featured ? "border-brand ring-1 ring-brand" : ""}`}>
                {featured && <span className="badge mb-2 self-start">Para quem tem várias turmas</span>}
                <h3 id={`plan-${id}`} className="text-xl">{p.name}</h3>
                <p className="mt-1 text-base text-ink-soft">{p.blurb}</p>
                <p className="mt-4 text-4xl font-extrabold tracking-tight">
                  {p.priceCents === null ? <span className="text-2xl">Sob proposta</span> : p.priceCents === 0 ? "R$ 0" : brl(p.priceCents).replace(/\s/, " ")}
                  {p.priceCents ? <span className="text-base font-medium text-ink-soft">/mês</span> : null}
                </p>
                <ul className="mt-4 flex-1 space-y-2.5 text-sm">
                  <li className="flex items-center gap-2"><Check /><span>{p.assemblies >= 10000 ? "Montagens conforme contrato" : `${p.assemblies} montagens por ciclo`}</span>
                    <Tooltip text="Conta na primeira gravação de uma prova nova com pelo menos uma questão. Revisar, trocar ou exportar a mesma prova não consome outra."><button type="button" className="grid h-6 w-6 place-items-center rounded-full border border-line text-xs text-ink-soft" aria-label="O que é uma montagem?">?</button></Tooltip></li>
                  <li className="flex items-center gap-2"><Check /><span>{p.classes >= 10000 ? "Turmas conforme contrato" : `${p.classes} turma${p.classes > 1 ? "s" : ""} ativa${p.classes > 1 ? "s" : ""}`}</span></li>
                  <li className="flex items-center gap-2"><Check /><span>{p.cards >= 100000 ? "Correção de cartões em volume" : `${p.cards} cartões corrigidos por ciclo`}</span></li>
                  <li className="flex items-center gap-2"><Check /><span>PDF do aluno, gabarito e notas</span></li>
                  <li className={`flex items-center gap-2 ${p.features.word ? "" : "text-ink-soft"}`}>{p.features.word ? <Check /> : <Dash />}<span>Word, segunda chamada e correção por foto</span></li>
                  {id === "school" && <li className="flex items-center gap-2"><Check /><span>Modelos da escola, convites e coordenação</span></li>}
                </ul>
                <div className="mt-5">
                  {id === "school" ? <Link className="btn btn-ghost w-full" href="/escolas">Conhecer o plano Escola</Link> : <Link className={`btn w-full ${featured ? "" : "btn-ghost"}`} href="/criar-conta">{id === "free" ? "Começar grátis" : "Assinar o Professor"}</Link>}
                </div>
              </article>);
          })}
        </div>
        <p className="mt-4 text-center text-sm"><Link href="/planos">Comparar planos em detalhe</Link></p>
      </section>

      {/* Para escolas */}
      <section id="para-escolas" aria-labelledby="escolas-h" className="mx-auto mt-14 max-w-6xl scroll-mt-24 px-4">
        <div className="card flex flex-wrap items-center justify-between gap-4 !p-6">
          <div className="max-w-xl"><h2 id="escolas-h" className="text-xl">Para escolas</h2><p className="mt-1 text-base text-ink-soft">Cabeçalho e regras de nota da escola, convites e coordenação. Mostramos o fluxo com dados de exemplo e combinamos um piloto.</p></div>
          <div className="flex flex-wrap gap-2"><DemoButton className="btn" /><Link className="btn btn-ghost" href="/escolas">Saiba mais</Link></div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="mx-auto mt-14 max-w-3xl px-4">
        <h2 id="faq" className="mb-4 text-2xl md:text-3xl">Perguntas frequentes</h2>
        <div className="space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card group !p-0 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-semibold">{q}<span aria-hidden className="text-brand transition-transform group-open:rotate-45">+</span></summary>
              <p className="px-4 pb-4 text-ink-soft">{a}</p>
            </details>))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div className="card flex flex-wrap items-center justify-between gap-4 !p-6 md:!p-8">
          <div><h2 className="text-xl md:text-2xl">Sua próxima prova pode ficar pronta hoje.</h2><p className="mt-1 text-ink-soft">Crie a conta, informe a turma e diga o que ensinou.</p></div>
          <Link className="btn btn-lg" href="/criar-conta">Criar minha primeira prova</Link>
        </div>
      </section>
    </>
  );
}

function Check() {
  return <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">✓</span>;
}
function Dash() {
  return <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line text-[11px]">–</span>;
}
