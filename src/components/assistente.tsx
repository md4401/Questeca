"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Link = { label: string; href: string };
type Msg = { id?: string; role: "user" | "assistant"; content: string; links?: Link[]; isError?: boolean };
type Sessao = { id: string; title: string; updatedAt: string | Date };
type Cred = { usados: number; limite: number; restantes: number };

const SUGESTOES = [
  "Monte uma prova de 10 questões sobre Machado de Assis para o 2º ano do Ensino Médio",
  "Crie um plano de aula de 50 minutos sobre porcentagem para o 9º ano",
  "Faça uma apresentação sobre a Revolução Francesa para o 8º ano",
  "Quais alunos preciso acompanhar de perto esta semana?",
];
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Texto simples com **negrito** e listas "- ", sem HTML injetado. */
function Texto({ t }: { t: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
  const blocos: React.ReactNode[] = []; let lista: string[] = [];
  const fecha = () => { if (lista.length) { blocos.push(<ul key={blocos.length} className="ml-5 list-disc space-y-0.5">{lista.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); lista = []; } };
  for (const l of t.split("\n")) { if (/^\s*[-•]\s+/.test(l)) lista.push(l.replace(/^\s*[-•]\s+/, "")); else { fecha(); if (l.trim()) blocos.push(<p key={blocos.length}>{inline(l)}</p>); } }
  fecha();
  return <div className="space-y-1.5">{blocos}</div>;
}

/** Agrupa as conversas como no ChatGPT: Hoje, Ontem, Últimos 7 dias e Anteriores. */
function agrupar(sessoes: Sessao[]) {
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const hoje = dia(new Date());
  const grupos: { nome: string; itens: Sessao[] }[] = [{ nome: "Hoje", itens: [] }, { nome: "Ontem", itens: [] }, { nome: "Últimos 7 dias", itens: [] }, { nome: "Anteriores", itens: [] }];
  for (const s of sessoes) {
    const d = (hoje - dia(new Date(s.updatedAt))) / 864e5;
    grupos[d < 1 ? 0 : d < 2 ? 1 : d < 8 ? 2 : 3].itens.push(s);
  }
  return grupos.filter((g) => g.itens.length);
}

export function Assistente({ disponivel, nome, creditos, sessoes: sessoesIniciais, ativa }: { disponivel: boolean; nome: string; creditos: Cred; sessoes: Sessao[]; ativa: { id: string; title: string; mensagens: Msg[] } | null }) {
  const [cred, setCred] = useState<Cred>(creditos);
  const [sessoes, setSessoes] = useState<Sessao[]>(sessoesIniciais);
  const [ativaId, setAtivaId] = useState<string | null>(ativa?.id ?? null);
  const [msgs, setMsgs] = useState<Msg[]>(ativa?.mensagens ?? []);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [lista, setLista] = useState(false); // gaveta de conversas no celular/tablet
  const [editando, setEditando] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [msgs, enviando]);
  const grupos = useMemo(() => agrupar(sessoes), [sessoes]);

  const url = (id: string | null) => { try { window.history.replaceState(null, "", id ? `/app/assistente?s=${id}` : "/app/assistente"); } catch { /* sem histórico */ } };
  const nova = () => { setAtivaId(null); setMsgs([]); setLista(false); url(null); };
  async function abrir(id: string) {
    if (id === ativaId || enviando) { setLista(false); return; }
    const r = await fetch(`/api/assistente/sessoes/${id}`);
    if (!r.ok) { setSessoes((l) => l.filter((s) => s.id !== id)); return; }
    const j = await r.json();
    setAtivaId(id); setMsgs(j.mensagens); setLista(false); url(id);
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
    setMsgs((m) => [...m, { role: "user", content: c }]); setTexto(""); setEnviando(true);
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
    } catch { setMsgs((m) => [...m, { role: "assistant", content: "Sem conexão com o assistente. Tente de novo.", isError: true }]); }
    setEnviando(false);
  }

  if (!disponivel) return <div className="card" role="status"><p className="font-medium">O assistente ainda não está ativado.</p><p className="hint mt-1">Falta configurar a IA nesta instalação: AI_PROVIDER=openai com OPENAI_API_KEY e AI_MODEL (ou nvidia/anthropic com a chave correspondente). Depois de editar o .env.local, reinicie o servidor.</p></div>;

  const painelConversas = (
    <nav aria-label="Conversas com o assistente" className="flex h-full flex-col gap-2">
      <button type="button" className="btn w-full" onClick={nova} data-testid="nova-conversa">+ Nova conversa</button>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {grupos.length === 0 && <p className="hint px-1">Suas conversas aparecem aqui.</p>}
        {grupos.map((g) => (
          <div key={g.nome}>
            <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{g.nome}</p>
            <ul className="space-y-0.5">
              {g.itens.map((s) => (
                <li key={s.id} className="group relative" data-testid="sessao-item">
                  {editando === s.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); void renomear(s.id); }}>
                      <label htmlFor={`rn-${s.id}`} className="sr-only">Novo nome da conversa</label>
                      <input id={`rn-${s.id}`} className="input !min-h-[36px] !py-1 text-sm" value={novoNome} maxLength={80} autoFocus onChange={(e) => setNovoNome(e.target.value)} onBlur={() => void renomear(s.id)} onKeyDown={(e) => { if (e.key === "Escape") setEditando(null); }} />
                    </form>
                  ) : (
                    <div className={`flex items-center rounded-lg ${s.id === ativaId ? "bg-brand-tint" : "hover:bg-brand-tint"}`}>
                      <button type="button" className="min-h-[40px] min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-sm" aria-current={s.id === ativaId ? "true" : undefined} onClick={() => void abrir(s.id)} title={s.title}>{s.title}</button>
                      <button type="button" className="icon-btn !h-8 !w-8 text-ink-soft" aria-label={`Renomear a conversa ${s.title}`} onClick={() => { setEditando(s.id); setNovoNome(s.title); }}>✎</button>
                      <button type="button" className="icon-btn !h-8 !w-8 text-ink-soft" aria-label={`Apagar a conversa ${s.title}`} onClick={() => void apagar(s)}>🗑</button>
                    </div>)}
                </li>))}
            </ul>
          </div>))}
      </div>
    </nav>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      {/* celular e tablet: conversas numa gaveta; computador: coluna fixa */}
      <div className="lg:hidden">
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={lista} aria-controls="lista-conversas" onClick={() => setLista((v) => !v)}>Conversas ({sessoes.length})</button>
        {lista && <div id="lista-conversas" className="card mt-2 max-h-[55vh] overflow-hidden">{painelConversas}</div>}
      </div>
      <aside className="card hidden max-h-[calc(100vh-9rem)] min-h-[60vh] overflow-hidden lg:block" aria-label="Histórico de conversas">{painelConversas}</aside>

      <section className="card flex min-h-[60vh] flex-col" aria-label="Conversa com o assistente">
        <div className="flex-1 space-y-4 overflow-y-auto pb-3" aria-live="polite">
          {msgs.length === 0 && (
            <div className="space-y-3 py-4">
              <p className="text-lg font-medium">Olá, {nome}. O que vamos fazer hoje?</p>
              <div className="grid gap-2 sm:grid-cols-2">{SUGESTOES.map((s) => <button key={s} type="button" className="btn btn-ghost !h-auto !justify-start !whitespace-normal !py-2 text-left text-sm" onClick={() => void enviar(s)}>{s}</button>)}</div>
            </div>)}
          {msgs.map((m, i) => (
            <div key={m.id ?? i} className={m.role === "user" ? "flex justify-end" : "flex"} data-testid={m.role === "user" ? "msg-usuario" : "msg-assistente"}>
              <div className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-brand-tint text-ink" : m.isError ? "border border-[var(--color-danger)] text-danger" : "border border-line"}`}>
                {m.role === "user" ? <p>{m.content}</p> : <Texto t={m.content} />}
                {m.links && m.links.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{m.links.map((l) => <a key={l.href} className="btn btn-sm" href={l.href}>{l.label}</a>)}</div>}
              </div>
            </div>))}
          {enviando && <p className="text-sm text-ink-soft" role="status">Pensando e consultando o seu sistema… isso pode levar até um minuto.</p>}
          <div ref={fim} />
        </div>
        <p className="pt-2 text-xs text-ink-soft" role="status" data-testid="creditos">Créditos de hoje: {fmt(cred.usados)} usados de {cred.limite} · restam {fmt(cred.restantes)}</p>
        <form className="flex gap-2 border-t border-line pt-3" onSubmit={(e) => { e.preventDefault(); void enviar(texto); }}>
          <label htmlFor="assistente-msg" className="sr-only">Mensagem para o assistente</label>
          <textarea id="assistente-msg" className="input min-h-[44px] flex-1" rows={2} value={texto} maxLength={4000} placeholder="Ex.: monte uma prova sobre funções para o 9º ano" onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(texto); } }} />
          <button className="btn" type="submit" disabled={enviando || !texto.trim()}>Enviar</button>
        </form>
      </section>
    </div>
  );
}
