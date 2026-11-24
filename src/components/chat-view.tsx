"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { sendMessageAction, editMessageAction, deleteMessageAction, pinMessageAction, reactAction, reportMessageAction, blockUserAction } from "@/lib/chat-actions";
import { REACTIONS, EDIT_WINDOW_MIN } from "@/lib/core/chat";
import { useToast } from "@/components/ui/toast";

type Msg = { id: string; mine: boolean; sender: string; body: string; deleted: boolean; pinned: boolean; edited: boolean; createdAt: string; createdMs: number; replyTo: string | null; reactions: { emoji: string; n: number; mine: boolean }[]; files: { id: string; name: string; type: string }[] };
const hm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/** Conversa com atualização por consulta a cada 4 s (só com a aba visível). Sem WebSocket: funciona em hospedagem serverless. */
export function ChatView({ convId, otherUserId }: { convId: string; otherUserId?: string }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const last = useRef(""); const endRef = useRef<HTMLDivElement>(null); const nearBottom = useRef(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/chat/${convId}`, { cache: "no-store" });
      if (!r.ok) { setError("Não foi possível carregar a conversa."); return; }
      const j = await r.json() as { messages: Msg[]; staff: boolean };
      const sig = JSON.stringify(j.messages);
      if (sig !== last.current) { last.current = sig; setMsgs(j.messages); }
      setStaff(j.staff); setError(null);
    } catch { setError("Sem conexão. Tentando de novo…"); }
  }, [convId]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 4000);
    const v = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [load]);
  useEffect(() => { if (nearBottom.current) endRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  const send = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget; const fd = new FormData(form);
    if (replyTo) fd.set("replyTo", replyTo.id);
    start(async () => {
      const r = await sendMessageAction(convId, null, fd);
      if (r?.error) toast(r.error, "error"); else { form.reset(); setReplyTo(null); nearBottom.current = true; await load(); }
    });
  };
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); await load(); });
  const now = Date.now();

  return (
    <div className="chat-view">
      <div className="chat-log" role="log" aria-live="polite" aria-label="Mensagens" onScroll={(e) => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {error && <p className="err text-sm" role="alert">{error}</p>}
        {msgs === null && !error && <div className="space-y-2" aria-hidden><div className="skeleton h-10 w-2/3" /><div className="skeleton ml-auto h-10 w-1/2" /></div>}
        {msgs?.length === 0 && <p className="p-4 text-center text-sm text-ink-soft">Nenhuma mensagem ainda. Diga olá.</p>}
        {msgs?.map((m, i) => {
          const newDay = i === 0 || day(msgs[i - 1].createdAt) !== day(m.createdAt);
          return (
            <div key={m.id}>
              {newDay && <p className="my-2 text-center text-xs font-semibold text-ink-soft">{day(m.createdAt)}</p>}
              <div className={`flex items-start gap-2 ${m.mine ? "justify-end" : "justify-start"}`}>
                {!m.mine && <span className="chat-av sm" aria-hidden>{m.sender.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</span>}
                <div className="max-w-[85%] min-w-0">
                  {!m.mine && <p className="chat-who">{m.sender}</p>}
                <div className={`text-sm ${m.mine ? "chat-b mine" : "chat-b"}`}>
                  
                  {m.pinned && <p className="text-xs font-bold opacity-80">📌 Fixada</p>}
                  {m.replyTo && <p className={`mb-1 rounded border-l-2 px-2 text-xs opacity-80 ${m.mine ? "border-white/60" : "border-brand"}`}>{m.replyTo.slice(0, 80)}</p>}
                  {m.deleted ? <p className="italic opacity-70">Mensagem apagada</p> : editing?.id === m.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await editMessageAction(m.id, editing.text); if (r?.error) toast(r.error, "error"); setEditing(null); }); }} className="flex gap-1">
                      <label className="sr-only" htmlFor={`e-${m.id}`}>Editar mensagem</label><input id={`e-${m.id}`} className="input !min-h-0 flex-1 !py-1 text-ink" value={editing.text} onChange={(e) => setEditing({ id: m.id, text: e.target.value })} />
                      <button className="rounded bg-white px-2 text-ink" type="submit">Salvar</button><button type="button" className="px-1" onClick={() => setEditing(null)}>×</button></form>
                  ) : <p className="whitespace-pre-line break-words">{m.body}</p>}
                  {m.files.map((f) => f.type.startsWith("image/") ? <a key={f.id} href={`/api/anexo/${f.id}`} target="_blank" rel="noreferrer"><img src={`/api/anexo/${f.id}`} alt={f.name} className="mt-1 max-h-48 rounded" /></a>
                    : f.type.startsWith("audio/") ? <audio key={f.id} controls src={`/api/anexo/${f.id}`} className="mt-1 max-w-full" aria-label={`Áudio ${f.name}`} />
                    : <p key={f.id} className="mt-1"><a className={m.mine ? "!text-white" : ""} href={`/api/anexo/${f.id}`}>📎 {f.name}</a></p>)}
                  <p className={`mt-1 text-[11px] ${m.mine ? "text-white/80" : "text-ink-soft"}`}>{hm(m.createdAt)}{m.edited ? " · editada" : ""}</p>
                  {m.reactions.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{m.reactions.map((r) => <button key={r.emoji} type="button" onClick={() => run(() => reactAction(m.id, r.emoji))} className={`rounded-full px-2 text-xs ${r.mine ? "bg-white text-brand" : "bg-white/70 text-ink"}`} aria-label={`${r.emoji} ${r.n}${r.mine ? ", você reagiu" : ""}`}>{r.emoji} {r.n}</button>)}</p>}
                  {!m.deleted && (
                    <details className="mt-1 text-xs"><summary className="cursor-pointer opacity-80">Ações</summary>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {REACTIONS.map((e) => <button key={e} type="button" className="text-base" onClick={() => run(() => reactAction(m.id, e))} aria-label={`Reagir com ${e}`}>{e}</button>)}
                        <button type="button" className="underline" onClick={() => setReplyTo(m)}>Responder</button>
                        {staff && <button type="button" className="underline" onClick={() => run(() => pinMessageAction(m.id, !m.pinned))}>{m.pinned ? "Desafixar" : "Fixar"}</button>}
                        {m.mine && now - m.createdMs <= EDIT_WINDOW_MIN * 60e3 && <button type="button" className="underline" onClick={() => setEditing({ id: m.id, text: m.body })}>Editar</button>}
                        {m.mine && <button type="button" className="underline" onClick={() => run(() => deleteMessageAction(m.id))}>Apagar</button>}
                        {!m.mine && <button type="button" className="underline" onClick={() => run(async () => { await reportMessageAction(m.id); toast("Denúncia enviada à coordenação.", "success"); })}>Denunciar</button>}
                        {!m.mine && otherUserId && <button type="button" className="underline" onClick={() => run(async () => { await blockUserAction(otherUserId); toast("Contato bloqueado.", "success"); })}>Bloquear</button>}
                      </div></details>)}
                </div>
                </div>
              </div>
            </div>);
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="chat-composer" aria-label="Enviar mensagem">
        {replyTo && <p className="mb-1 flex items-center justify-between rounded bg-brand-tint px-2 py-1 text-xs">Respondendo a {replyTo.sender}: {replyTo.body.slice(0, 60)}<button type="button" className="px-1" onClick={() => setReplyTo(null)} aria-label="Cancelar resposta">×</button></p>}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="chat-body">Mensagem</label>
          <textarea id="chat-body" name="body" rows={1} maxLength={3000} className="chat-input" placeholder="Digite uma mensagem..." onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
          <label className="chat-clip cursor-pointer" title="Anexar imagem, PDF ou áudio (até 2 MB)"><span aria-hidden>📎</span><span className="sr-only">Anexar arquivo</span><input type="file" name="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,audio/mpeg,audio/ogg,audio/webm,audio/mp4,text/plain" /></label>
          <button className="chat-send" type="submit" disabled={pending} aria-busy={pending}>Enviar</button>
        </div>
      </form>
    </div>
  );
}
