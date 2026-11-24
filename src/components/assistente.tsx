"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Link = { label: string; href: string };
type Msg = { id?: string; role: "user" | "assistant"; content: string; links?: Link[]; isError?: boolean };
type Sessao = { id: string; title: string; updatedAt: string | Date };
type Cred = { usados: number; limite: number; restantes: number };

const SUGESTOES = [
  { icone: "📝", curto: "Montar uma prova", texto: "Monte uma prova de 10 questões sobre Machado de Assis para o 2º ano do Ensino Médio" },
  { icone: "📅", curto: "Plano de aula", texto: "Crie um plano de aula de 50 minutos sobre porcentagem para o 9º ano" },
  { icone: "📊", curto: "Apresentação", texto: "Faça uma apresentação sobre a Revolução Francesa para o 8º ano" },
  { icone: "👥", curto: "Alunos em risco", texto: "Quais alunos preciso acompanhar de perto esta semana?" },
];
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Texto simples com **negrito** e listas "- ", sem HTML injetado. */
function Texto({ t }: { t: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
  const blocos: React.ReactNode[] = []; let lista: string[] = [];
  const fecha = () => { if (lista.length) { blocos.push(<ul key={blocos.length} className="ml-5 list-disc space-y-1">{lista.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); lista = []; } };
  for (const l of t.split("\n")) { if (/^\s*[-•]\s+/.test(l)) lista.push(l.replace(/^\s*[-•]\s+/, "")); else { fecha(); if (l.trim()) blocos.push(<p key={blocos.length}>{inline(l)}</p>); } }
  fecha();
  return <div className="space-y-2">{blocos}</div>;
}

/** Agrupa as conversas como no Gemini/ChatGPT: Hoje, Ontem, Últimos 7 dias e Anteriores. */
function agrupar(sessoes: Sessao[]) {
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const hoje = dia(new Date());
  const grupos: { nome: string; itens: Sessao[] }[] = [{ nome: "Hoje", itens: [] }, { nome: "Ontem", itens: [] }, { nome: "Últimos 7 dias", itens: [] }, { nome: "Anteriores", itens: [] }];
  for (const s of sessoes) { const d = (hoje - dia(new Date(s.updatedAt))) / 864e5; grupos[d < 1 ? 0 : d < 2 ? 1 : d < 8 ? 2 : 3].itens.push(s); }
  return grupos.filter((g) => g.itens.length);
}

const Faisca = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></svg>
);

type SR = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export function Assistente({ disponivel, nome, creditos, sessoes: sessoesIniciais, ativa }: { disponivel: boolean; nome: string; creditos: Cred; sessoes: Sessao[]; ativa: { id: string; title: string; mensagens: Msg[] } | null }) {
  const [cred, setCred] = useState<Cred>(creditos);
  const [sessoes, setSessoes] = useState<Sessao[]>(sessoesIniciais);
  const [ativaId, setAtivaId] = useState<string | null>(ativa?.id ?? null);
  const [msgs, setMsgs] = useState<Msg[]>(ativa?.mensagens ?? []);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gaveta, setGaveta] = useState(false); // celular/tablet: painel de conversas sobreposto
  const [recolhido, setRecolhido] = useState(false); // computador: painel recolhido
  const [busca, setBusca] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [menuMais, setMenuMais] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [voz, setVoz] = useState(false);
  const [copiado, setCopiado] = useState<number | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const rec = useRef<SR | null>(null);

  // a interface ocupa toda a área útil (abaixo da barra superior e do aviso de e-mail, acima das abas do celular)
  useLayoutEffect(() => {
    const ajusta = () => {
      const el = raiz.current; if (!el) return;
      const topo = el.getBoundingClientRect().top + window.scrollY;
      const abas = window.innerWidth < 640 ? 64 : 0;
      el.style.height = `${Math.max(window.innerHeight - topo - abas, 420)}px`;
    };
    ajusta(); window.addEventListener("resize", ajusta);
    return () => window.removeEventListener("resize", ajusta);
  }, []);
  useEffect(() => { try { setRecolhido(localStorage.getItem("giz_side") === "0"); } catch { /* sem armazenamento */ } setVoz(typeof window !== "undefined" && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)); }, []);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [msgs, enviando]);
  useEffect(() => { const c = campo.current; if (c) { c.style.height = "auto"; c.style.height = `${Math.min(c.scrollHeight, 160)}px`; } }, [texto]);
  const grupos = useMemo(() => agrupar(sessoes.filter((s) => !busca || s.title.toLowerCase().includes(busca.toLowerCase()))), [sessoes, busca]);

  const url = (id: string | null) => { try { window.history.replaceState(null, "", id ? `/app/assistente?s=${id}` : "/app/assistente"); } catch { /* sem histórico */ } };
  const alternarPainel = () => { if (window.innerWidth < 1024) setGaveta((v) => !v); else setRecolhido((v) => { try { localStorage.setItem("giz_side", v ? "1" : "0"); } catch { /* ok */ } return !v; }); };
  const nova = () => { setAtivaId(null); setMsgs([]); setGaveta(false); url(null); setTimeout(() => campo.current?.focus(), 0); };
  async function abrir(id: string) {
    if (id === ativaId || enviando) { setGaveta(false); return; }
    const r = await fetch(`/api/assistente/sessoes/${id}`);
    if (!r.ok) { setSessoes((l) => l.filter((s) => s.id !== id)); return; }
    const j = await r.json();
    setAtivaId(id); setMsgs(j.mensagens); setGaveta(false); url(id);
  }
  async function renomear(id: string) {
    const t = novoNome.trim(); setEditando(null);
    if (!t) return;
    const r = await fetch(`/api/assistente/sessoes/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ titulo: t }) });
    if (r.ok) setSessoes((l) => l.map((s) => (s.id === id ? { ...s, title: t.slice(0, 80) } : s)));
  }
  async function apagar(s: Sessao) {
    if (!confirm(`Apagar a conversa “${s.title}”? Isso não pode ser desfeito.`)) return;
    const r = await fetch(`/api/assistente/sessoes/${s.id}`, { method: "DELETE" });
    if (!r.ok) return;
    setSessoes((l) => l.filter((x) => x.id !== s.id));
    if (s.id === ativaId) nova();
  }
  async function enviar(conteudo: string) {
    const c = conteudo.trim();
    if (!c || enviando) return;
    setMsgs((m) => [...m, { role: "user", content: c }]); setTexto(""); setEnviando(true); setMenuMais(false);
    try {
      const r = await fetch("/api/assistente", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: c, sessionId: ativaId ?? undefined }) });
      const j = await r.json();
      if (j.creditos) setCred(j.creditos);
      if (j.sessionId) {
        if (j.sessionId !== ativaId) { setAtivaId(j.sessionId); url(j.sessionId); }
        setSessoes((l) => { const resto = l.filter((s) => s.id !== j.sessionId); return [{ id: j.sessionId, title: j.titulo ?? c.slice(0, 48), updatedAt: new Date().toISOString() }, ...resto]; });
      }
      if (!r.ok) setMsgs((m) => [...m, { role: "assistant", content: j.erro ?? "Não consegui responder agora.", isError: true }]);
      else setMsgs((m) => [...m, { role: "assistant", content: j.texto, links: j.links }]);
    } catch { setMsgs((m) => [...m, { role: "assistant", content: "Sem conexão com a GizIA. Tente de novo.", isError: true }]); }
    setEnviando(false);
  }
  const ditar = () => {
    if (ouvindo && rec.current) { rec.current.stop(); return; }
    const W = window as unknown as Record<string, new () => SR>;
    const r = new (W.SpeechRecognition || W.webkitSpeechRecognition)();
    r.lang = "pt-BR"; r.interimResults = false; r.continuous = true;
    r.onresult = (e) => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + " "; setTexto((a) => (a ? a.trimEnd() + " " : "") + t.trim()); };
    r.onend = () => setOuvindo(false); r.onerror = () => setOuvindo(false);
    r.start(); rec.current = r; setOuvindo(true);
  };
  const copiar = async (i: number, t: string) => { try { await navigator.clipboard.writeText(t); setCopiado(i); setTimeout(() => setCopiado(null), 1500); } catch { /* sem permissão */ } };

  if (!disponivel) return (
    <div className="giz-root giz-vazio" ref={raiz}>
      <div className="giz-indisponivel" role="status"><span className="giz-logo"><Faisca size={26} /></span><h1>A GizIA ainda não está ativada</h1><p>Falta configurar a IA nesta instalação: AI_PROVIDER=openai com OPENAI_API_KEY e AI_MODEL (ou nvidia/anthropic com a chave correspondente). Depois de editar o .env.local, reinicie o servidor.</p></div>
    </div>);

  const composer = (
    <form className="giz-composer" onSubmit={(e) => { e.preventDefault(); void enviar(texto); }}>
      <div className="giz-pill">
        <div className="giz-mais">
          <button type="button" className="giz-ico" aria-label="Atalhos de pedidos" aria-expanded={menuMais} onClick={() => setMenuMais((v) => !v)}>＋</button>
          {menuMais && (
            <ul className="giz-menu" role="menu" aria-label="Atalhos de pedidos">
              {SUGESTOES.map((s) => <li key={s.curto} role="none"><button type="button" role="menuitem" onClick={() => { setTexto(s.texto); setMenuMais(false); campo.current?.focus(); }}><span aria-hidden>{s.icone}</span>{s.curto}</button></li>)}
            </ul>)}
        </div>
        <label htmlFor="assistente-msg" className="sr-only">Mensagem para a GizIA</label>
        <textarea id="assistente-msg" ref={campo} rows={1} className="giz-campo" value={texto} maxLength={4000} placeholder="Peça à GizIA" onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(texto); } }} />
        {voz && <button type="button" className={`giz-ico ${ouvindo ? "on" : ""}`} aria-label={ouvindo ? "Parar ditado" : "Ditar mensagem"} aria-pressed={ouvindo} onClick={ditar}>🎤</button>}
        <button className="giz-enviar" type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg>
        </button>
      </div>
    </form>
  );

  return (
    <div className="giz-root" ref={raiz} data-recolhido={recolhido ? "1" : undefined}>
      {gaveta && <button type="button" className="giz-fundo" aria-label="Fechar conversas" onClick={() => setGaveta(false)} />}
      <aside className="giz-side" data-aberta={gaveta ? "1" : undefined} aria-label="Histórico de conversas">
        <div className="giz-side-top">
          <button type="button" className="giz-ico" aria-label="Recolher conversas" onClick={alternarPainel}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M9.5 4.5v15" /></svg>
          </button>
          <button type="button" className="giz-ico" aria-label="Buscar conversas" aria-pressed={busca !== null} onClick={() => setBusca((b) => (b === null ? "" : null))}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-3.8-3.8" /></svg>
          </button>
        </div>
        {busca !== null && <div className="px-3 pb-2"><label htmlFor="giz-busca" className="sr-only">Buscar conversas</label><input id="giz-busca" className="giz-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conversas" autoFocus /></div>}
        <nav aria-label="Conversas com a GizIA" className="giz-nav">
          <button type="button" className="giz-nova" onClick={nova} data-testid="nova-conversa"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /></svg>Nova conversa</button>
          <div className="giz-lista">
            {grupos.length === 0 && <p className="giz-dica">{busca ? "Nenhuma conversa encontrada." : "Suas conversas aparecem aqui."}</p>}
            {grupos.map((g) => (
              <div key={g.nome}>
                <p className="giz-grupo">{g.nome}</p>
                <ul>
                  {g.itens.map((s) => (
                    <li key={s.id} data-testid="sessao-item" className="giz-item" data-ativa={s.id === ativaId ? "1" : undefined}>
                      {editando === s.id ? (
                        <form onSubmit={(e) => { e.preventDefault(); void renomear(s.id); }}>
                          <label htmlFor={`rn-${s.id}`} className="sr-only">Novo nome da conversa</label>
                          <input id={`rn-${s.id}`} className="giz-busca" value={novoNome} maxLength={80} autoFocus onChange={(e) => setNovoNome(e.target.value)} onBlur={() => void renomear(s.id)} onKeyDown={(e) => { if (e.key === "Escape") setEditando(null); }} />
                        </form>
                      ) : (
                        <>
                          <button type="button" className="giz-titulo" aria-current={s.id === ativaId ? "true" : undefined} onClick={() => void abrir(s.id)} title={s.title}>{s.title}</button>
                          <span className="giz-acoes">
                            <button type="button" aria-label={`Renomear a conversa ${s.title}`} onClick={() => { setEditando(s.id); setNovoNome(s.title); }}>✎</button>
                            <button type="button" aria-label={`Apagar a conversa ${s.title}`} onClick={() => void apagar(s)}>🗑</button>
                          </span>
                        </>)}
                    </li>))}
                </ul>
              </div>))}
          </div>
        </nav>
      </aside>

      <section className="giz-main" aria-label="Conversa com a GizIA">
        <header className="giz-top">
          <button type="button" className="giz-ico giz-abrir" aria-label="Mostrar conversas" onClick={alternarPainel}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
          </button>
          <h1 className="giz-nome"><span className="giz-logo"><Faisca size={18} /></span>GizIA</h1>
          <p className="giz-cred" role="status" data-testid="creditos">Créditos de hoje: {fmt(cred.usados)} usados de {cred.limite} · restam {fmt(cred.restantes)}</p>
        </header>

        {msgs.length === 0 ? (
          <div className="giz-inicio">
            <p className="giz-ola">Olá, {nome}</p>
            <p className="giz-pergunta">Por onde começamos?</p>
            <div className="giz-centro">{composer}</div>
            <div className="giz-chips">{SUGESTOES.map((s) => <button key={s.curto} type="button" className="giz-chip" onClick={() => void enviar(s.texto)}><span aria-hidden>{s.icone}</span>{s.curto}</button>)}</div>
          </div>
        ) : (
          <>
            <div className="giz-scroll" aria-live="polite">
              <div className="giz-conversa">
                {msgs.map((m, i) => (
                  <div key={m.id ?? i} className={m.role === "user" ? "giz-msg giz-usuario" : "giz-msg giz-resposta"} data-testid={m.role === "user" ? "msg-usuario" : "msg-assistente"}>
                    {m.role === "assistant" && <span className="giz-logo giz-avatar"><Faisca size={16} /></span>}
                    <div className={m.isError ? "giz-balao giz-erro" : "giz-balao"}>
                      {m.role === "user" ? <p>{m.content}</p> : <Texto t={m.content} />}
                      {m.links && m.links.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{m.links.map((l) => <a key={l.href} className="btn btn-sm" href={l.href}>{l.label}</a>)}</div>}
                      {m.role === "assistant" && !m.isError && <button type="button" className="giz-copiar" aria-label="Copiar resposta" onClick={() => void copiar(i, m.content)}>{copiado === i ? "Copiado ✓" : "Copiar"}</button>}
                    </div>
                  </div>))}
                {enviando && <div className="giz-msg giz-resposta" role="status"><span className="giz-logo giz-avatar giz-gira"><Faisca size={16} /></span><div className="giz-balao"><p className="giz-pensando">Pensando e consultando o seu sistema…</p></div></div>}
                <div ref={fim} />
              </div>
            </div>
            <div className="giz-rodape">{composer}<p className="giz-aviso">A GizIA pode errar. Confira provas e gabaritos antes de aplicar. Seus dados só são usados para responder a você.</p></div>
          </>)}
      </section>
    </div>
  );
}
