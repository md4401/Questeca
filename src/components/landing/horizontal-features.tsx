"use client";
import { useEffect, useRef, useState } from "react";

const FEATURES = [
  { tag: "Correção", title: "Cartão-resposta por foto", text: "Fotografe pelo celular. Leituras duvidosas ficam ao lado da imagem para você confirmar; nada entra na nota sozinho.", art: "bubbles" },
  { tag: "Notas", title: "Média com a fórmula à vista", text: "Pesos, ausências, recuperação e arredondamento seguem a regra da escola. Zero, falta e pendente nunca se confundem.", art: "formula" },
  { tag: "Retomada", title: "Próxima aula com questões reais", text: "O acerto por conteúdo aponta o que retomar e a Questeca separa itens do acervo para prática e checagem.", art: "bars" },
  { tag: "Segunda chamada", title: "Outra versão, mesmo desenho", text: "Mesmas habilidades, pontos e tempo, com itens diferentes e sem variantes da questão original.", art: "versions" },
  { tag: "Aplicação digital", title: "Um link por aluno", text: "Cada estudante responde pelo próprio link, uma única vez, sem criar conta. As respostas chegam corrigidas.", art: "link" },
  { tag: "Coordenação", title: "Documentos no modelo da escola", text: "Diário, relatório individual e conselho de classe a partir do que você registrou. O que não tem evidência fica em aberto.", art: "doc" },
  { tag: "Comunidade", title: "Troca entre professores", text: "Mural geral ou da escola, com moderação. Dados de alunos são bloqueados antes de publicar.", art: "chat" },
];

function Art({ kind }: { kind: string }) {
  const box = "mb-5 flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-brand-tint to-white";
  if (kind === "bubbles") return <div className={box}><div className="grid grid-cols-5 gap-1.5">{Array.from({ length: 15 }, (_, k) => <span key={k} className="bubble" style={{ width: 20, height: 20 }} data-on={[1, 7, 13].includes(k)} />)}</div></div>;
  if (kind === "formula") return <div className={box}><p className="mono text-sm">7,5 × 0,6 + 9 × 0,4 = <b className="text-brand-dark">8,1</b></p></div>;
  if (kind === "bars") return <div className={`${box} items-end gap-2 pb-4`}>{[70, 43, 85, 58].map((h, k) => <span key={k} className={`w-6 rounded-t-md ${h < 60 ? "bg-[#F0A79E]" : "bg-brand"}`} style={{ height: `${h}%` }} />)}</div>;
  if (kind === "versions") return <div className={box}><span className="rounded-lg border bg-white px-4 py-3 font-bold shadow">A</span><span className="mx-3 text-brand">→</span><span className="rounded-lg border border-brand bg-white px-4 py-3 font-bold text-brand shadow">B</span></div>;
  if (kind === "link") return <div className={box}><span className="mono rounded-full bg-white px-3 py-1.5 text-xs shadow">questeca.app/r/•••• </span></div>;
  if (kind === "doc") return <div className={box}><div className="w-24 space-y-1.5 rounded-md bg-white p-3 shadow">{[1, 2, 3, 4].map((k) => <div key={k} className={`h-1.5 rounded ${k === 3 ? "bg-amber-tint outline-1 outline-dashed outline-amber" : "bg-[#E3E9F6]"}`} />)}</div></div>;
  return <div className={`${box} flex-col gap-1.5`}><span className="self-start ml-8 rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-xs shadow">Alguém tem lista de frações?</span><span className="self-end mr-8 rounded-2xl rounded-br-sm bg-brand px-3 py-1.5 text-xs text-white">Compartilhei a minha 👇</span></div>;
}

/** Recursos em trilho horizontal fixado na tela (horizontal scroll ligado à rolagem vertical). */
export function HorizontalFeatures() {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [height, setHeight] = useState<number | undefined>();
  useEffect(() => {
    const mq = matchMedia("(min-width: 900px) and (prefers-reduced-motion: no-preference)");
    let raf = 0;
    const measure = () => {
      const on = mq.matches;
      setPinned(on);
      if (!on || !track.current) { setHeight(undefined); if (track.current) track.current.style.transform = ""; return; }
      setHeight(track.current.scrollWidth - innerWidth + innerHeight + 80);
    };
    const tick = () => {
      raf = 0;
      if (!mq.matches || !wrap.current || !track.current) return;
      const r = wrap.current.getBoundingClientRect();
      const total = wrap.current.offsetHeight - innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
      track.current.style.transform = `translate3d(${(-p * (track.current.scrollWidth - innerWidth + 64)).toFixed(1)}px,0,0)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    measure(); tick();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", () => { measure(); tick(); });
    mq.addEventListener("change", measure);
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); mq.removeEventListener("change", measure); };
  }, []);
  return (
    <div ref={wrap} style={{ height }} className="relative">
      <div className={pinned ? "sticky top-0 flex h-screen flex-col justify-center overflow-hidden" : ""}>
        <div className="mx-auto mb-8 w-full max-w-6xl px-4">
          <p className="mono text-sm text-brand">Depois da prova</p>
          <h2 className="display mt-2 max-w-2xl text-4xl md:text-5xl">A mesma avaliação continua trabalhando por você.</h2>
        </div>
        <div ref={track} className={`flex gap-5 px-4 will-change-transform md:px-[max(1rem,calc((100vw-72rem)/2+1rem))] ${pinned ? "" : "snap-x snap-mandatory overflow-x-auto pb-6"}`} tabIndex={pinned ? undefined : 0} aria-label="Recursos">
          {FEATURES.map((f) => (
            <article key={f.title} className="glass hover-lift w-[78vw] shrink-0 snap-start p-6 sm:w-[340px]">
              <Art kind={f.art} />
              <span className="badge">{f.tag}</span>
              <h3 className="display mt-3 text-2xl leading-tight">{f.title}</h3>
              <p className="mt-2 text-ink-soft">{f.text}</p>
            </article>))}
        </div>
      </div>
    </div>
  );
}
