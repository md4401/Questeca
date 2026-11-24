import Link from "next/link";
import { ScrollFX } from "@/components/landing/scroll-fx";
import { StickySteps } from "@/components/landing/sticky-steps";
import { HorizontalFeatures } from "@/components/landing/horizontal-features";
import { CountUp } from "@/components/landing/count-up";
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

export default function Home() {
  const order = ["free", "teacher", "school"] as const;
  return (
    <>
      <ScrollFX />

      {/* HERO — a tese: o filtro de conteúdo ao vivo */}
      <section className="relative -mt-20 overflow-hidden pb-16 pt-32 md:pb-24 md:pt-44">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div data-parallax="0.25" className="absolute -left-32 -top-24 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,#BCD3FF_0%,transparent_65%)] opacity-90" />
          <div data-parallax="-0.15" className="absolute -right-24 top-24 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,#D6E4FF_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(#C9D6F2_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)] opacity-60" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <div>
            <h1 className="reveal text-[2.5rem] font-extrabold leading-[1.04] md:text-[3.7rem]" style={{ ["--d" as string]: "80ms" }}>
              A prova que só cobra o que você{" "}
              <span className="relative whitespace-nowrap text-brand">
                ensinou.
                <svg aria-hidden viewBox="0 0 220 18" className="absolute -bottom-2 left-0 w-full" preserveAspectRatio="none"><path d="M3 13 C 60 4, 140 4, 217 10" fill="none" stroke="#8DB6FF" strokeWidth="6" strokeLinecap="round" /></svg>
              </span>
            </h1>
            <p className="reveal mx-auto mt-5 max-w-2xl text-lg text-ink-soft md:text-xl" style={{ ["--d" as string]: "160ms" }}>
              Questões reais de provas públicas, escolhidas pelo raciocínio que exigem. Você diz o que a turma estudou; a Questeca monta a prova, separa o gabarito e acompanha a correção até a próxima aula.
            </p>
            <div className="reveal mt-8 flex flex-wrap items-center justify-center gap-3" style={{ ["--d" as string]: "240ms" }}>
              <Link className="btn btn-lg" href="/criar-conta">Criar primeira prova grátis</Link>
              <DemoButton />
            </div>
            <p className="reveal mt-4 text-sm text-ink-soft" style={{ ["--d" as string]: "300ms" }}>Grátis para começar. Sem cartão de crédito.</p>
          </div>
        </div>
      </section>

      {/* O problema, com dados da TALIS 2024 (gatilho de rolagem + contagem) */}
      <section aria-labelledby="dados" className="mx-auto max-w-6xl px-4">
        <div className="glass grid gap-px overflow-hidden md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div className="bg-white/50 p-6">
            <h2 id="dados" className="text-2xl">Onde vai a semana do professor</h2>
            <p className="mt-2 text-sm text-ink-soft">Médias declaradas por docentes brasileiros dos anos finais do Fundamental, em tempo integral.</p>
          </div>
          {[[9.3, " h", "preparando aulas"], [6.1, " h", "corrigindo trabalhos"], [59.8, "%", "citam o volume de provas para corrigir como fonte de estresse"]].map(([n, s, l]) => (
            <div key={String(l)} className="reveal bg-white/50 p-6">
              <p className="display text-5xl font-extrabold text-brand-dark"><CountUp to={Number(n)} decimals={1} suffix={String(s)} /></p>
              <p className="mt-2 text-sm text-ink-soft">{l}</p>
            </div>))}
        </div>
        <p className="mt-3 text-right text-xs text-ink-soft">Fonte: OCDE/Inep, TALIS 2024 — Relatório nacional.</p>
      </section>

      {/* COMO FUNCIONA — sticky + scroll linked */}
      <section id="como-funciona" className="mx-auto mt-28 max-w-6xl scroll-mt-28 px-4">
        <div className="reveal mb-10 max-w-2xl">
          <p className="mono text-sm text-brand">Como funciona</p>
          <h2 className="display mt-2 text-4xl md:text-5xl">Do conteúdo da aula ao gabarito, em quatro passos.</h2>
        </div>
        <StickySteps />
      </section>

      {/* RECURSOS — horizontal scroll */}
      <section id="recursos" className="mt-20 scroll-mt-20">
        <HorizontalFeatures />
      </section>

      {/* CONFIANÇA — parallax em vidro escuro */}
      <section aria-labelledby="confianca" className="relative mx-3 mt-24 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0B1E52] via-[#122C7A] to-[#1F4FE0] py-24 text-white md:mx-6">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div data-parallax="0.3" className="absolute -left-10 top-10 grid grid-cols-6 gap-4 opacity-25">{Array.from({ length: 24 }, (_, k) => <span key={k} className="h-6 w-6 rounded-full border-2 border-white/80" style={{ background: k % 7 === 2 ? "#fff" : "transparent" }} />)}</div>
          <div data-parallax="-0.2" className="absolute -bottom-20 right-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,#5B8CFF_0%,transparent_65%)] opacity-70" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <p className="reveal mono text-sm text-[#BFD3FF]">Procedência</p>
          <h2 id="confianca" className="reveal display mt-3 max-w-3xl text-4xl leading-tight md:text-6xl">A IA escolhe e explica. Nunca inventa questão.</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              ["Origem verificável", "Banca, edição, caderno, número e página de cada item, com o gabarito oficial da versão aplicada."],
              ["Direito de uso por item", "Cada questão tem um estado: em curadoria, só referência, liberada, em revisão ou bloqueada. Só as liberadas entram na prova."],
              ["Dados da turma protegidos", "Acesso por escola, turma e papel. Notas, fotos e observações são privadas e não treinam modelos de IA."],
            ].map(([t, d], i) => (
              <div key={t} className="reveal glass-dark hover-lift rounded-[1.25rem] p-6" style={{ ["--d" as string]: `${i * 90}ms` }}>
                <span aria-hidden className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/30"><span className="h-3.5 w-3.5 rounded-full bg-white" /></span>
                <h3 className="display text-xl">{t}</h3>
                <p className="mt-2 text-[#D5E1FF]">{d}</p>
              </div>))}
          </div>
        </div>
      </section>

      {/* PLANOS — preço em vidro */}
      <section id="planos" aria-labelledby="planos-h" className="relative mt-28 scroll-mt-28 overflow-hidden px-4">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,#C5D7FF_0%,transparent_65%)]" />
        <div className="mx-auto max-w-6xl">
          <div className="reveal mx-auto mb-12 max-w-2xl text-center">
            <p className="mono text-sm text-brand">Planos</p>
            <h2 id="planos-h" className="display mt-2 text-4xl md:text-5xl">Comece grátis. Cresça quando a rotina pedir.</h2>
            <p className="mt-3 text-ink-soft">Valores em fase de validação com professores e escolas.</p>
          </div>
          <div className="grid items-stretch gap-5 md:grid-cols-3">
            {order.map((id, i) => {
              const p = PLANS[id];
              const featured = id === "teacher";
              return (
                <article key={id} aria-labelledby={`plan-${id}`} className={`reveal glass hover-lift relative flex flex-col p-7 ${featured ? "glass-strong ring-2 ring-brand/70 md:-translate-y-3" : ""}`} style={{ ["--d" as string]: `${i * 90}ms` }}>
                  {featured && <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white shadow">Para quem tem várias turmas</span>}
                  <h3 id={`plan-${id}`} className="display text-2xl">{p.name}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{p.blurb}</p>
                  <p className="display mt-6 text-5xl font-extrabold tracking-tight">
                    {p.priceCents === null ? <span className="text-3xl">Sob proposta</span> : p.priceCents === 0 ? "R$ 0" : brl(p.priceCents).replace(/\s/, " ")}
                    {p.priceCents ? <span className="text-base font-medium text-ink-soft">/mês</span> : null}
                  </p>
                  <ul className="mt-6 flex-1 space-y-3 text-sm">
                    <li className="flex items-center gap-2"><Check /><span>{p.assemblies >= 10000 ? "Montagens conforme contrato" : `${p.assemblies} montagens por ciclo`}</span>
                      <Tooltip text="Conta na primeira gravação de uma prova nova com pelo menos uma questão. Revisar, trocar ou exportar a mesma prova não consome outra."><button type="button" className="grid h-5 w-5 place-items-center rounded-full border border-line text-[11px] font-bold text-ink-soft hover:border-brand hover:text-brand" aria-label="O que é uma montagem assistida">?</button></Tooltip></li>
                    <li className="flex items-center gap-2"><Check /><span>{p.classes >= 10000 ? "Turmas conforme contrato" : `${p.classes} turma${p.classes > 1 ? "s" : ""} ativa${p.classes > 1 ? "s" : ""}`}</span></li>
                    <li className="flex items-center gap-2"><Check /><span>{p.cards >= 100000 ? "Correção de cartões em volume" : `${p.cards} cartões corrigidos por ciclo`}</span></li>
                    <li className="flex items-center gap-2"><Check /><span>PDF do aluno, gabarito e notas</span></li>
                    <li className={`flex items-center gap-2 ${p.features.word ? "" : "text-ink-soft"}`}>{p.features.word ? <Check /> : <Dash />}<span>Word, segunda chamada e correção por foto</span></li>
                    {id === "school" && <li className="flex items-center gap-2"><Check /><span>Modelos da escola, convites e coordenação</span></li>}
                  </ul>
                  <div className="mt-7">
                    {id === "school" ? <DemoButton label="Falar com a equipe" className="btn btn-glass w-full" /> : <Link className={`btn w-full ${featured ? "" : "btn-glass"}`} href="/criar-conta">{id === "free" ? "Começar grátis" : "Assinar o Professor"}</Link>}
                  </div>
                </article>);
            })}
          </div>
          <p className="mt-6 text-center text-sm"><Link href="/planos">Comparar planos em detalhe</Link></p>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="mx-auto mt-28 max-w-3xl px-4">
        <h2 id="faq" className="reveal display mb-8 text-center text-4xl">Perguntas frequentes</h2>
        <div className="space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="reveal glass group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {q}
                <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-tint text-brand transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-ink-soft">{a}</p>
            </details>))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto mt-28 max-w-6xl px-4">
        <div className="reveal glass glass-strong relative overflow-hidden p-10 text-center md:p-16">
          <div aria-hidden className="absolute -right-10 -top-10 flex gap-3 opacity-60">{["A", "B", "C", "D", "E"].map((L) => <span key={L} className="bubble" data-on={L === "C"}>{L}</span>)}</div>
          <h2 className="display mx-auto max-w-2xl text-4xl md:text-5xl">Sua próxima prova pode ficar pronta hoje.</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-ink-soft">Crie a conta, informe a turma e diga o que ensinou. O primeiro rascunho chega explicado, questão por questão.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><Link className="btn btn-lg" href="/criar-conta">Criar primeira prova grátis</Link><Link className="btn btn-glass btn-lg" href="/escolas">Conhecer o plano Escola</Link></div>
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
