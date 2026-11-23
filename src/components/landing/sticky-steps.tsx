"use client";
import { useEffect, useRef, useState } from "react";

const STEPS = [
  { title: "Diga o que a turma estudou", text: "Cole suas anotações, envie o PDF ou o DOCX da apostila, ou use o diário da turma. Você confirma o que vai cair, o que já é pré-requisito e o que ainda não ensinou." },
  { title: "Revise um rascunho explicado", text: "A Questeca monta a prova só com questões existentes e diz por que escolheu cada uma. Troque, fixe, reordene e acompanhe o mapa de conteúdos, pontos e tempo." },
  { title: "Imprima no padrão da escola", text: "A folha do aluno sai com o cabeçalho da escola e sem gabarito. O gabarito do professor vai em outro arquivo, com fonte e referência de cada item." },
  { title: "Corrija e decida a próxima aula", text: "Lance respostas pela grade, pela planilha ou por foto do cartão. A nota aparece com a fórmula usada e o acerto por conteúdo indica o que retomar." },
];

function Mock({ i }: { i: number }) {
  if (i === 0) return (
    <div className="space-y-2.5">
      {[["Vai cair", "Porcentagem simples · Descontos sucessivos", "bg-brand text-white"], ["É pré-requisito", "Frações · Decimais", "bg-brand-tint text-brand-dark"], ["Ainda não ensinei", "Juros compostos", "bg-[#FDECEA] text-danger"], ["Preciso confirmar", "Leitura de gráficos", "bg-amber-tint text-amber"]].map(([k, v, c]) => (
        <div key={k} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${c}`}>{k}</span><span className="text-right text-sm">{v}</span></div>))}
    </div>);
  if (i === 1) return (
    <div className="grid grid-cols-[1fr_120px] gap-3">
      <div className="space-y-2">{["Desconto simples em camisa", "Dois descontos de 10%", "Aumento e desconto de 20%"].map((t, k) => <div key={t} className="rounded-xl border border-line bg-white p-3 text-sm"><span className="mono text-xs text-ink-soft">Q0{k + 1}</span> {t}<div className="mt-1 text-xs font-semibold text-brand">Trocar · Fixar · Ver fonte</div></div>)}</div>
      <div className="rounded-xl bg-brand-tint p-3 text-xs"><p className="font-bold text-brand-dark">Mapa</p><p className="mt-1">3 × porcentagem</p><p>2 × descontos</p><p className="mt-2 font-semibold">35 min</p><p>10 pontos</p></div>
    </div>);
  if (i === 2) return (
    <div className="relative h-60">
      <div className="absolute left-0 top-2 w-[62%] rotate-[-3deg] rounded-lg border border-line bg-white p-4 shadow-xl"><p className="text-[10px] font-bold">COLÉGIO EXEMPLO</p><p className="text-[10px] text-ink-soft">Aluno(a): ____________ Turma: 9º B</p><div className="mt-3 space-y-1.5">{[1, 2, 3, 4].map((k) => <div key={k} className="h-1.5 rounded bg-[#E3E9F6]" style={{ width: `${90 - k * 9}%` }} />)}</div><p className="mt-3 text-[10px] text-ink-soft">Folha do aluno · sem gabarito</p></div>
      <div className="absolute right-0 top-10 w-[50%] rotate-[4deg] rounded-lg border border-brand/30 bg-white p-4 shadow-xl"><p className="text-[10px] font-bold text-brand-dark">GABARITO · PROFESSOR</p>{["1 · B", "2 · B", "3 · D", "4 · C"].map((g) => <p key={g} className="mono mt-1 text-xs">{g}</p>)}</div>
    </div>);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">{["A", "B", "C", "D", "E"].map((L) => <span key={L} className="bubble" data-on={L === "B"}>{L}</span>)}</div>
      <div className="rounded-xl border border-line bg-white p-3"><p className="text-xs text-ink-soft">Média de Davi</p><p className="mono mt-1 text-sm">7,50 × 0,60 + 9,00 × 0,40 = <strong className="text-brand-dark">8,10</strong></p></div>
      <div className="rounded-xl border border-line bg-white p-3 text-sm"><p className="text-xs text-ink-soft">Merece atenção</p><p>Descontos sucessivos · <strong className="text-danger">43% de acerto</strong></p></div>
    </div>);
}

/** Etapas com painel fixo (sticky) que acompanha a rolagem (scroll linked). */
export function StickySteps() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
    }, { rootMargin: "-45% 0px -45% 0px" });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16">
      <div className="hidden md:block">
        <div className="sticky top-28">
          <div className="glass glass-strong p-6">
            <div className="mb-4 flex items-center gap-2" aria-hidden>{STEPS.map((_, k) => <span key={k} className="bubble" data-on={k <= active}>{k + 1}</span>)}</div>
            <div key={active} className="animate-[toast-in_.45s_var(--ease-out)]"><Mock i={active} /></div>
          </div>
        </div>
      </div>
      <ol className="space-y-6 md:space-y-0">
        {STEPS.map((s, i) => (
          <li key={s.title} ref={(el) => { refs.current[i] = el; }} data-i={i} className="md:flex md:min-h-[62vh] md:items-center">
            <div className={`border-l-4 border-transparent pl-5 transition-colors duration-500 ${i === active ? "md:border-brand" : "md:border-line"}`}>
              <span className="mono text-sm text-brand">Etapa {i + 1} de 4</span>
              <h3 className="display mt-2 text-3xl leading-tight md:text-4xl">{s.title}</h3>
              <p className="mt-3 max-w-md text-lg text-ink-soft">{s.text}</p>
              <div className="glass mt-5 p-4 md:hidden"><Mock i={i} /></div>
            </div>
          </li>))}
      </ol>
    </div>
  );
}
