"use client";
import { useCallback, useEffect, useState } from "react";
import { avancarAction, encerrarJogoAction } from "../../actions";

type Estado = { state: "lobby" | "question" | "results" | "ended"; current: number; total: number; code: string; pergunta: { texto: string; opcoes: string[]; segundos: number; restanteMs: number; certa: number | null } | null; respondidas: number; contagem: number[] | null; jogadores: { nickname: string; score: number; pos: number }[] };
const COR = ["#1F4FE0", "#0E7A45", "#B45309", "#9333EA"]; const FORMA = ["▲", "◆", "●", "■"];

/** Tela do professor (projetável): código para entrar, perguntas, contagem de respostas e placar. Atualiza a cada 1,5 s. */
export function HostPanel({ gameId, code }: { gameId: string; code: string }) {
  const [s, setS] = useState<Estado | null>(null); const [rest, setRest] = useState(0); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const r = await fetch(`/api/quiz/host/${gameId}`, { cache: "no-store" }); if (r.ok) { const j = (await r.json()) as Estado; setS(j); setRest(j.pergunta?.restanteMs ?? 0); } } catch { /* tenta de novo */ }
  }, [gameId]);
  useEffect(() => { load(); const t = setInterval(load, 1500); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (s?.state !== "question") return; const t = setInterval(() => setRest((r) => Math.max(0, r - 250)), 250); return () => clearInterval(t); }, [s?.state, s?.current]);
  const url = typeof window !== "undefined" ? `${window.location.origin}/jogar` : "/jogar";
  async function go(fn: () => Promise<unknown>) { setBusy(true); await fn(); await load(); setBusy(false); }
  if (!s) return <p className="p-6 text-ink-soft">Carregando…</p>;
  const nJog = s.jogadores.length;
  return (
    <div className="quiz-host">
      <div className="quiz-top"><div><p className="hint">Entre em <b>{url.replace(/^https?:\/\//, "")}</b> e digite o código</p><p className="quiz-code" data-testid="codigo-jogo" aria-label={`Código ${code}`}>{code}</p></div><p className="quiz-count" aria-live="polite"><b>{nJog}</b> jogador(es)</p></div>
      {s.state === "lobby" && (
        <section className="card text-center"><h2 className="mb-3">Sala de espera</h2>
          <ul className="quiz-chips">{s.jogadores.map((j) => <li key={j.nickname}>{j.nickname}</li>)}{nJog === 0 && <li className="hint">Aguardando alunos entrarem…</li>}</ul>
          <button className="btn mt-4" disabled={busy || nJog === 0} onClick={() => go(() => avancarAction(gameId))} data-testid="comecar">Começar ({s.total} pergunta(s))</button></section>)}
      {(s.state === "question" || s.state === "results") && s.pergunta && (
        <section className="card">
          <div className="flex items-center justify-between"><p className="hint">Pergunta {s.current + 1} de {s.total}</p>{s.state === "question" && <p className="quiz-timer" aria-live="off">{Math.ceil(rest / 1000)} s · {s.respondidas}/{nJog} responderam</p>}</div>
          <h2 className="my-3 text-2xl">{s.pergunta.texto}</h2>
          <ul className="quiz-opts">{s.pergunta.opcoes.map((o, i) => (
            <li key={i} className={s.state === "results" && s.pergunta!.certa !== i ? "dim" : ""} style={{ background: COR[i] }}><span aria-hidden>{FORMA[i]}</span> {o}{s.state === "results" && <b className="quiz-n">{s.contagem?.[i] ?? 0}{s.pergunta!.certa === i ? " ✓" : ""}</b>}</li>))}</ul>
          <div className="mt-4 flex gap-3"><button className="btn" disabled={busy} onClick={() => go(() => avancarAction(gameId))} data-testid="avancar">{s.state === "question" ? "Mostrar resposta" : s.current + 1 >= s.total ? "Ver resultado final" : "Próxima pergunta"}</button></div>
        </section>)}
      {(s.state === "results" || s.state === "ended") && (
        <section className="card"><h2 className="mb-2 text-lg">{s.state === "ended" ? "Resultado final" : "Placar"}</h2>
          <ol className="quiz-rank">{s.jogadores.slice(0, s.state === "ended" ? 10 : 5).map((j) => <li key={j.nickname}><span>{j.pos}º</span><b>{j.nickname}</b><span>{j.score} pts</span></li>)}</ol></section>)}
      {s.state !== "ended" && <button className="link-btn text-danger" onClick={() => go(() => encerrarJogoAction(gameId))}>Encerrar jogo</button>}
    </div>
  );
}
