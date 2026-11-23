"use client";
import { useRef, useState } from "react";

/** No celular, o editor separa "Prova" e "Mapa" em abas e lembra a posição de rolagem de cada uma (a questão ativa continua onde estava). */
export function EditorTabs({ main, side, count }: { main: React.ReactNode; side: React.ReactNode; count: number }) {
  const [tab, setTab] = useState<"prova" | "mapa">("prova");
  const pos = useRef({ prova: 0, mapa: 0 });
  const sw = (t: "prova" | "mapa") => {
    if (t === tab) return;
    pos.current[tab] = window.scrollY;
    setTab(t);
    requestAnimationFrame(() => window.scrollTo(0, pos.current[t]));
  };
  const tabs: ["prova" | "mapa", string][] = [["prova", `Prova (${count})`], ["mapa", "Mapa e ajustes"]];
  return (
    <>
      <div role="tablist" aria-label="Seções do editor" className="seg no-print sticky top-[calc(3.2rem+env(safe-area-inset-top))] z-20 mb-4 lg:hidden">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" type="button" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} onClick={() => sw(k)} onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") sw(tab === "prova" ? "mapa" : "prova"); }}>{label}</button>))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]" data-tab={tab}>
        <div id="panel-prova" role="tabpanel" aria-labelledby="tab-prova" className="ed-main space-y-4">{main}</div>
        <aside id="panel-mapa" role="tabpanel" aria-labelledby="tab-mapa" className="ed-side space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">{side}</aside>
      </div>
    </>
  );
}
