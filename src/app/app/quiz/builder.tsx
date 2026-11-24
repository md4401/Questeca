"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Form, SubmitButton } from "@/components/form";
import { salvarQuizAction } from "./actions";

type P = { k: number; texto: string; opcoes: string[]; certa: number; segundos: number };
const TEMPOS = [10, 20, 30, 45, 60, 90, 120];
const FORMA = ["▲", "◆", "●", "■"];
const COR = ["#1F4FE0", "#0E7A45", "#B45309", "#9333EA"];

/** Construtor de quiz no estilo Google Formulários: um cartão por pergunta, opções com marcador de "certa", tempo por pergunta. */
export function QuizBuilder({ id, titulo = "", inicial = [] }: { id: string | null; titulo?: string; inicial?: { texto: string; opcoes: string[]; certa: number; segundos: number }[] }) {
  const prox = useRef(1);
  const nova = (): P => ({ k: prox.current++, texto: "", opcoes: ["", "", "", ""], certa: 0, segundos: 20 });
  const [ps, setPs] = useState<P[]>(() => (inicial.length ? inicial.map((p) => ({ ...p, k: prox.current++ })) : [nova()]));
  const [foco, setFoco] = useState<number>(ps[0].k);
  const upd = (k: number, f: (p: P) => P) => setPs((a) => a.map((p) => (p.k === k ? f(p) : p)));
  const add = () => { const n = nova(); setPs((a) => [...a, n]); setFoco(n.k); setTimeout(() => document.getElementById(`q-${n.k}`)?.focus(), 30); };
  const dup = (k: number) => setPs((a) => { const i = a.findIndex((p) => p.k === k); const c = { ...a[i], k: prox.current++, opcoes: [...a[i].opcoes] }; setFoco(c.k); return [...a.slice(0, i + 1), c, ...a.slice(i + 1)]; });
  const del = (k: number) => setPs((a) => (a.length > 1 ? a.filter((p) => p.k !== k) : a));
  const mover = (k: number, d: -1 | 1) => setPs((a) => { const i = a.findIndex((p) => p.k === k); const j = i + d; if (j < 0 || j >= a.length) return a; const c = [...a]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const limpa = (p: P) => { const m = p.opcoes.map((o, i) => ({ o, i })).filter((x) => x.o.trim() || x.i === p.certa); return { texto: p.texto, opcoes: m.map((x) => x.o), certa: m.findIndex((x) => x.i === p.certa), segundos: p.segundos }; };
  const json = JSON.stringify(ps.map(limpa));
  return (
    <Form action={salvarQuizAction.bind(null, id)} toast className="qb">
      <input type="hidden" name="perguntas" value={json} />
      <section className="qb-card qb-title">
        <label htmlFor="title" className="sr-only">Nome do quiz</label>
        <input id="title" name="title" className="qb-titulo" defaultValue={titulo} placeholder="Nome do quiz" required maxLength={120} />
        <p className="hint">{ps.length} pergunta(s) · os alunos respondem pelo celular e ganham pontos pela rapidez.</p>
      </section>
      {ps.map((p, i) => (
        <section key={p.k} className={`qb-card ${foco === p.k ? "on" : ""}`} onFocusCapture={() => setFoco(p.k)} onClick={() => setFoco(p.k)} data-testid="pergunta">
          <div className="qb-top"><span className="qb-num">{i + 1}</span>
            <label className="sr-only" htmlFor={`q-${p.k}`}>Pergunta {i + 1}</label>
            <textarea id={`q-${p.k}`} className="qb-enun" rows={1} value={p.texto} maxLength={300} placeholder="Pergunta" onChange={(e) => { upd(p.k, (x) => ({ ...x, texto: e.target.value })); e.target.style.height = "auto"; e.target.style.height = `${e.target.scrollHeight}px`; }} /></div>
          <ul className="qb-opts" role="radiogroup" aria-label={`Opções da pergunta ${i + 1}`}>
            {p.opcoes.map((o, oi) => (
              <li key={oi} className={p.certa === oi ? "certa" : ""}>
                <button type="button" className="qb-radio" role="radio" aria-checked={p.certa === oi} aria-label={p.certa === oi ? `Opção ${oi + 1} é a certa` : `Marcar opção ${oi + 1} como certa`} title="Marcar como certa" style={{ borderColor: COR[oi], background: p.certa === oi ? COR[oi] : "transparent" }} onClick={() => upd(p.k, (x) => ({ ...x, certa: oi }))}>{p.certa === oi ? "✓" : ""}</button>
                <span className="qb-forma" style={{ color: COR[oi] }} aria-hidden>{FORMA[oi]}</span>
                <input className="qb-op" value={o} maxLength={120} placeholder={`Opção ${oi + 1}${oi >= 2 ? " (opcional)" : ""}`} aria-label={`Texto da opção ${oi + 1} da pergunta ${i + 1}`} onChange={(e) => upd(p.k, (x) => ({ ...x, opcoes: x.opcoes.map((y, yi) => (yi === oi ? e.target.value : y)) }))} />
              </li>))}
          </ul>
          <p className="hint qb-dica">Toque no círculo para marcar a resposta certa. Deixe em branco as opções que não for usar.</p>
          <div className="qb-foot">
            <label className="qb-tempo">Tempo <select value={p.segundos} onChange={(e) => upd(p.k, (x) => ({ ...x, segundos: Number(e.target.value) }))}>{TEMPOS.map((t) => <option key={t} value={t}>{t} s</option>)}</select></label>
            <span className="qb-acts">
              <button type="button" onClick={() => mover(p.k, -1)} disabled={i === 0} aria-label={`Subir pergunta ${i + 1}`} title="Subir">↑</button>
              <button type="button" onClick={() => mover(p.k, 1)} disabled={i === ps.length - 1} aria-label={`Descer pergunta ${i + 1}`} title="Descer">↓</button>
              <button type="button" onClick={() => dup(p.k)} aria-label={`Duplicar pergunta ${i + 1}`} title="Duplicar">⧉</button>
              <button type="button" onClick={() => del(p.k)} disabled={ps.length === 1} aria-label={`Excluir pergunta ${i + 1}`} title="Excluir">🗑</button>
            </span>
          </div>
        </section>))}
      <div className="qb-bar">
        <button type="button" className="btn btn-ghost" onClick={add} data-testid="add-pergunta">＋ Adicionar pergunta</button>
        <SubmitButton>Salvar quiz</SubmitButton>
        <Link className="link-btn" href="/app/assistente?novo=quiz">Prefere que a GizIA escreva?</Link>
      </div>
    </Form>
  );
}
