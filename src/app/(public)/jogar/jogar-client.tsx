"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Est = { state: "lobby" | "question" | "results" | "ended"; total: number; current: number; jogadores: number; meuApelido: string; meuTotal: number; pergunta?: { texto: string; opcoes: string[]; segundos: number; restanteMs: number }; respondi?: number | null; certa?: number; contagem?: number[]; acertei?: boolean; meusPontos?: number; pos?: number | null; top?: { nickname: string; score: number; pos: number }[] };
const COR = ["#1F4FE0", "#0E7A45", "#B45309", "#9333EA"]; const FORMA = ["▲", "◆", "●", "■"];
const KEY = "segunda-lousa-quiz";

/** Tela do aluno (celular): código + apelido, depois responde tocando numa cor. Sem cadastro. */
export function JogarClient() {
  const [code, setCode] = useState(""); const [nick, setNick] = useState(""); const [erro, setErro] = useState("");
  const [sess, setSess] = useState<{ code: string; player: string; secret: string } | null>(null);
  const [est, setEst] = useState<Est | null>(null); const [escolha, setEscolha] = useState<number | null>(null); const [rest, setRest] = useState(0);
  const qAtual = useRef(-1);
  useEffect(() => { try { const s = sessionStorage.getItem(KEY); if (s) setSess(JSON.parse(s)); const c = new URLSearchParams(location.search).get("codigo"); if (c) setCode(c); } catch { /* sem storage */ } }, []);
  const carregar = useCallback(async () => {
    if (!sess) return;
    try {
      const r = await fetch(`/api/quiz/estado?code=${sess.code}&player=${sess.player}&secret=${sess.secret}`, { cache: "no-store" });
      if (r.status === 404) { try { sessionStorage.removeItem(KEY); } catch { /* ok */ } setSess(null); setErro("Esse jogo não existe mais."); return; }
      const j = (await r.json()) as Est;
      if (j.current !== qAtual.current) { qAtual.current = j.current; setEscolha(j.respondi ?? null); }
      setEst(j); setRest(j.pergunta?.restanteMs ?? 0);
    } catch { /* tenta de novo */ }
  }, [sess]);
  useEffect(() => { if (!sess) return; carregar(); const t = setInterval(carregar, 1500); return () => clearInterval(t); }, [sess, carregar]);
  useEffect(() => { if (est?.state !== "question") return; const t = setInterval(() => setRest((r) => Math.max(0, r - 250)), 250); return () => clearInterval(t); }, [est?.state, est?.current]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    const r = await fetch("/api/quiz/entrar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, nickname: nick }) });
    const j = await r.json();
    if (!r.ok) { setErro(j.error ?? "Não foi possível entrar."); return; }
    const s = { code: code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6), player: j.playerId, secret: j.secret };
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ok */ }
    qAtual.current = -1; setSess(s);
  }
  async function responder(i: number) {
    if (!sess || escolha !== null) return;
    setEscolha(i);
    const r = await fetch("/api/quiz/responder", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: sess.code, player: sess.player, secret: sess.secret, choice: i }) });
    if (!r.ok) { const j = await r.json(); setErro(j.error ?? ""); }
  }

  if (!sess || !est) {
    return (
      <main className="mx-auto max-w-sm px-4 py-10"><h1 className="mb-1 text-2xl">Entrar no quiz</h1><p className="hint mb-4">Digite o código que o professor mostrou na lousa.</p>
        <form onSubmit={entrar} className="card space-y-3">
          <div className="field"><label htmlFor="codigo">Código</label><input id="codigo" className="input text-center text-2xl font-bold uppercase tracking-widest" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" autoCapitalize="characters" /></div>
          <div className="field"><label htmlFor="apelido">Seu apelido</label><input id="apelido" className="input" maxLength={20} value={nick} onChange={(e) => setNick(e.target.value)} autoComplete="off" /></div>
          {erro && <p className="err text-sm" role="alert">{erro}</p>}
          <button className="btn w-full" type="submit">Entrar</button></form></main>);
  }
  return (
    <main className="mx-auto max-w-lg px-4 py-6" aria-live="polite">
      <p className="hint mb-3 flex justify-between"><span>{est.meuApelido}</span><span>{est.meuTotal} pts</span></p>
      {est.state === "lobby" && <section className="card text-center"><h1 className="text-xl">Você está dentro!</h1><p className="mt-2 text-ink-soft">Aguarde o professor começar… ({est.jogadores} na sala)</p></section>}
      {est.state === "question" && est.pergunta && (
        <section><div className="mb-2 flex justify-between"><span className="hint">Pergunta {est.current + 1}/{est.total}</span><span className="quiz-timer">{Math.ceil(rest / 1000)} s</span></div>
          <h1 className="mb-4 text-xl">{est.pergunta.texto}</h1>
          {escolha !== null ? <p className="card text-center">Resposta enviada! Aguarde os colegas…</p> : (
            <div className="grid gap-3">{est.pergunta.opcoes.map((o, i) => <button key={i} type="button" className="quiz-btn" style={{ background: COR[i] }} disabled={rest <= 0} onClick={() => responder(i)}><span aria-hidden>{FORMA[i]}</span> {o}</button>)}</div>)}
        </section>)}
      {est.state === "results" && est.pergunta && (
        <section className="card text-center"><h1 className="text-2xl">{escolha === null ? "Sem resposta" : est.acertei ? "Acertou! 🎉" : "Errou"}</h1>
          <p className="mt-1 text-ink-soft">{est.acertei ? `+${est.meusPontos} pontos` : `A certa era: ${est.pergunta.opcoes[est.certa ?? 0]}`}</p>
          <p className="mt-3 text-lg">Você está em <b>{est.pos}º</b> lugar</p></section>)}
      {est.state === "ended" && (
        <section className="card text-center"><h1 className="text-2xl">Fim de jogo!</h1><p className="mt-2 text-lg">Você ficou em <b>{est.pos}º</b> com {est.meuTotal} pontos</p>
          <ol className="quiz-rank mt-3 text-left">{est.top?.slice(0, 5).map((j) => <li key={j.nickname}><span>{j.pos}º</span><b>{j.nickname}</b><span>{j.score} pts</span></li>)}</ol></section>)}
      {erro && <p className="err mt-3 text-sm" role="alert">{erro}</p>}
    </main>
  );
}
