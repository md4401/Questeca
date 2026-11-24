"use client";
import { useEffect, useRef, useState } from "react";

type Link = { label: string; href: string };
type Msg = { role: "user" | "assistant"; content: string; links?: Link[]; erro?: boolean };

const SUGESTOES = [
  "Monte uma prova de 10 questões sobre Machado de Assis para o 2º ano do Ensino Médio",
  "Crie um plano de aula de 50 minutos sobre porcentagem para o 9º ano",
  "Faça uma apresentação sobre a Revolução Francesa para o 8º ano",
  "Quais alunos preciso acompanhar de perto esta semana?",
];

/** Texto simples com **negrito** e listas "- ", sem HTML injetado. */
function Texto({ t }: { t: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
  const blocos: React.ReactNode[] = []; let lista: string[] = [];
  const fecha = () => { if (lista.length) { blocos.push(<ul key={blocos.length} className="ml-5 list-disc space-y-0.5">{lista.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); lista = []; } };
  for (const l of t.split("\n")) { if (/^\s*[-•]\s+/.test(l)) lista.push(l.replace(/^\s*[-•]\s+/, "")); else { fecha(); if (l.trim()) blocos.push(<p key={blocos.length}>{inline(l)}</p>); } }
  fecha();
  return <div className="space-y-1.5">{blocos}</div>;
}

export function Assistente({ disponivel, nome }: { disponivel: boolean; nome: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [msgs, enviando]);

  async function enviar(conteudo: string) {
    const c = conteudo.trim();
    if (!c || enviando) return;
    const historico: Msg[] = [...msgs, { role: "user", content: c }];
    setMsgs(historico); setTexto(""); setEnviando(true);
    try {
      const r = await fetch("/api/assistente", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: historico.filter((m) => !m.erro).map((m) => ({ role: m.role, content: m.content })) }) });
      const j = await r.json();
      if (!r.ok) setMsgs([...historico, { role: "assistant", content: j.erro ?? "Não consegui responder agora.", erro: true }]);
      else setMsgs([...historico, { role: "assistant", content: j.texto, links: j.links }]);
    } catch { setMsgs([...historico, { role: "assistant", content: "Sem conexão com o assistente. Tente de novo.", erro: true }]); }
    setEnviando(false);
  }

  if (!disponivel) return <div className="card" role="status"><p className="font-medium">O assistente ainda não está ativado.</p><p className="hint mt-1">Falta configurar a chave de IA (AI_PROVIDER e NVIDIA_API_KEY ou ANTHROPIC_API_KEY) nesta instalação. Enquanto isso, use “Montar prova” e “Planos de aula”.</p></div>;

  return (
    <section className="card flex min-h-[60vh] flex-col" aria-label="Conversa com o assistente">
      <div className="flex-1 space-y-4 overflow-y-auto pb-3" aria-live="polite">
        {msgs.length === 0 && (
          <div className="space-y-3 py-4">
            <p className="text-lg font-medium">Olá, {nome}. O que vamos fazer hoje?</p>
            <div className="grid gap-2 sm:grid-cols-2">{SUGESTOES.map((s) => <button key={s} type="button" className="btn btn-ghost !h-auto !justify-start !whitespace-normal !py-2 text-left text-sm" onClick={() => void enviar(s)}>{s}</button>)}</div>
          </div>)}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <div className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-[var(--brand)] text-white" : m.erro ? "border border-[var(--danger)] text-danger" : "bg-surface-2"}`}>
              {m.role === "user" ? <p>{m.content}</p> : <Texto t={m.content} />}
              {m.links && m.links.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{m.links.map((l) => <a key={l.href} className="btn btn-sm" href={l.href}>{l.label}</a>)}</div>}
            </div>
          </div>))}
        {enviando && <p className="text-sm text-ink-soft" role="status">Pensando e consultando o seu sistema… isso pode levar até um minuto.</p>}
        <div ref={fim} />
      </div>
      <form className="flex gap-2 border-t border-line pt-3" onSubmit={(e) => { e.preventDefault(); void enviar(texto); }}>
        <label htmlFor="assistente-msg" className="sr-only">Mensagem para o assistente</label>
        <textarea id="assistente-msg" className="input min-h-[44px] flex-1" rows={2} value={texto} maxLength={4000} placeholder="Ex.: monte uma prova sobre funções para o 9º ano" onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(texto); } }} />
        <button className="btn" type="submit" disabled={enviando || !texto.trim()}>Enviar</button>
      </form>
    </section>
  );
}
