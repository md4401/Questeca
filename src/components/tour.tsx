"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TOURS, type PassoTour } from "@/lib/core/tours";
import { tourVistoAction } from "@/app/app/actions";

type Rect = { top: number; left: number; width: number; height: number };
const visivel = (el: Element) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 4 && r.height > 4 && cs.visibility !== "hidden" && cs.display !== "none"; };
function achar(sel?: string[]): HTMLElement | null {
  for (const s of sel ?? []) { try { for (const el of Array.from(document.querySelectorAll<HTMLElement>(s))) if (visivel(el)) return el; } catch { /* seletor inválido */ } }
  return null;
}
const chave = (id: string) => `tour-visto:${id}`;
const lerLocal = (id: string) => { try { return localStorage.getItem(chave(id)) === "1"; } catch { return false; } };

/** Tour de primeira visita: escurece a página, destaca uma região por vez e explica (Voltar, Próximo, Pular). */
export function Tour({ seen }: { seen: string[] }) {
  const path = usePathname();
  const tour = TOURS[path];
  const [passos, setPassos] = useState<PassoTour[] | null>(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; seta: number; lado: "abaixo" | "acima" | "centro" } | null>(null);
  const pop = useRef<HTMLDivElement>(null); const next = useRef<HTMLButtonElement>(null);

  const iniciar = useCallback((forcar: boolean) => {
    if (!tour) return;
    const lista = tour.passos.filter((p, k) => !p.sel || achar(p.sel) || (k === 0 && false));
    if (!lista.length) return;
    setPassos(lista); setI(0);
    void forcar;
  }, [tour]);

  // início automático na primeira visita (não roda em navegador automatizado, salvo se pedido)
  useEffect(() => {
    setPassos(null);
    if (!tour) return;
    try { if (navigator.webdriver && !localStorage.getItem("tour-force")) return; } catch { /* ok */ }
    if (seen.includes(tour.id) || lerLocal(tour.id)) return;
    const t = setTimeout(() => iniciar(false), 1100);
    return () => clearTimeout(t);
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = () => iniciar(true); window.addEventListener("tour:restart", h); return () => window.removeEventListener("tour:restart", h); }, [iniciar]);

  const fechar = useCallback(() => {
    if (tour) { try { localStorage.setItem(chave(tour.id), "1"); } catch { /* ok */ } void tourVistoAction(tour.id).catch(() => {}); }
    setPassos(null); setRect(null);
  }, [tour]);

  // mede o alvo do passo atual e posiciona o balão
  const medir = useCallback(() => {
    if (!passos) return;
    const alvo = achar(passos[i]?.sel);
    const W = window.innerWidth, H = window.innerHeight;
    const larg = Math.min(340, W - 24);
    if (!alvo) { setRect(null); setPos({ top: Math.max(16, H / 2 - 90), left: (W - larg) / 2, seta: 0, lado: "centro" }); return; }
    const r = alvo.getBoundingClientRect();
    const pad = 6; const box = { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
    setRect(box);
    const h = pop.current?.offsetHeight ?? 170;
    const left = Math.min(Math.max(12, box.left + box.width / 2 - larg / 2), W - larg - 12);
    const seta = Math.min(Math.max(20, box.left + box.width / 2 - left), larg - 20);
    if (box.top + box.height + 14 + h < H - 8) setPos({ top: box.top + box.height + 14, left, seta, lado: "abaixo" });
    else if (box.top - 14 - h > 8) setPos({ top: box.top - 14 - h, left, seta, lado: "acima" });
    else setPos({ top: Math.max(12, H - h - 16), left: (W - larg) / 2, seta: 0, lado: "centro" });
  }, [passos, i]);

  useLayoutEffect(() => {
    if (!passos) return;
    const alvo = achar(passos[i]?.sel);
    alvo?.scrollIntoView({ block: "center", behavior: "auto" });
    medir();
    const raf = requestAnimationFrame(medir);
    return () => cancelAnimationFrame(raf);
  }, [passos, i, medir]);
  useEffect(() => {
    if (!passos) return;
    let raf = 0; const h = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(medir); };
    window.addEventListener("resize", h); window.addEventListener("scroll", h, true);
    const t = setTimeout(medir, 350); // depois da animação de rolagem/layout
    return () => { window.removeEventListener("resize", h); window.removeEventListener("scroll", h, true); clearTimeout(t); cancelAnimationFrame(raf); };
  }, [passos, i, medir]);
  useEffect(() => {
    if (!passos) return;
    next.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); else if (e.key === "ArrowRight") setI((x) => Math.min(passos.length - 1, x + 1)); else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [passos, i, fechar]);

  if (!passos || !pos) return null;
  const p = passos[i]; const ultimo = i === passos.length - 1;
  return (
    <div className="tour" role="presentation">
      <div className="tour-block" />
      {rect ? <div className="tour-spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} /> : <div className="tour-dim" />}
      <div ref={pop} className="tour-pop" role="dialog" aria-modal="true" aria-label={`Tour: ${p.titulo}`} data-lado={pos.lado} style={{ top: pos.top, left: pos.left, ["--seta" as string]: `${pos.seta}px` }}>
        <button type="button" className="tour-x" onClick={fechar} aria-label="Fechar o tour">×</button>
        <h2>{p.titulo}</h2>
        <p>{p.texto}</p>
        <div className="tour-foot">
          <button type="button" className="tour-pular" onClick={fechar}>Pular</button>
          <span className="tour-cont" aria-live="polite">{i + 1} de {passos.length}</span>
          {i > 0 && <button type="button" className="tour-volta" onClick={() => setI(i - 1)}>← Voltar</button>}
          <button ref={next} type="button" className="tour-prox" onClick={() => (ultimo ? fechar() : setI(i + 1))}>{ultimo ? "Concluir" : "Próximo →"}</button>
        </div>
      </div>
    </div>
  );
}

/** Botão do cabeçalho que refaz o tour da página atual. Some nas páginas sem tour. */
export function TourButton() {
  const path = usePathname();
  if (!TOURS[path]) return null;
  return <button type="button" className="icon-btn" aria-label="Refazer o tour desta página" title="Tour desta página" onClick={() => window.dispatchEvent(new Event("tour:restart"))}><span aria-hidden>🧭</span></button>;
}
