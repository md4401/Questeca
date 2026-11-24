"use client";
import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Form, SubmitButton } from "@/components/form";
import { startDirectAction, createGroupAction } from "@/lib/chat-actions";

export type ConvItem = { id: string; title: string; kind: string; unread: number; muted: boolean; at: string; preview: string };
export type Contact = { userId: string; name: string; detail: string };

const hoje = (iso: string) => { const d = new Date(iso), n = new Date(); const f = (x: Date) => x.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }); return f(d) === f(n) ? d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }); };
const ini = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

/** Coluna esquerda das Mensagens: busca, conversas (com prévia e não lidas) e botão "+" para nova conversa/grupo. */
export function ChatList({ convs, contacts, base, activeId }: { convs: ConvItem[]; contacts: Contact[]; base: string; activeId?: string }) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const lista = convs.filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="chat-list">
      <div className="chat-list-head">
        <h1>Mensagens</h1>
        <button type="button" className="chat-plus" onClick={() => setOpen(true)} aria-label="Nova conversa" aria-haspopup="dialog" data-testid="nova-conversa">＋</button>
      </div>
      <div className="chat-search"><label className="sr-only" htmlFor="chat-q">Buscar conversas</label><input id="chat-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversas…" autoComplete="off" /></div>
      <ul className="chat-items">
        {convs.length === 0 && <li className="chat-vazio">{contacts.length === 0 ? "Ninguém disponível ainda. Convide colegas pela página da escola." : "Nenhuma conversa ainda. Toque em ＋ para começar."}</li>}
        {convs.length > 0 && lista.length === 0 && <li className="chat-vazio">Nada encontrado.</li>}
        {lista.map((c) => (
          <li key={c.id}>
            <Link href={`${base}/${c.id}`} className={`chat-item ${c.id === activeId ? "on" : ""}`} aria-current={c.id === activeId ? "page" : undefined}>
              <span className="chat-av" aria-hidden>{c.kind === "direct" ? ini(c.title) : "👥"}{c.unread > 0 && <span className="chat-badge">{c.unread}</span>}</span>
              <span className="chat-txt">
                <span className="chat-l1"><b>{c.title}</b><time>{hoje(c.at)}</time></span>
                <span className="chat-l2">{c.preview || (c.kind === "direct" ? "Conversa iniciada" : c.kind === "class" ? "Turma" : "Grupo")}{c.muted ? " · 🔕" : ""}</span>
              </span>
              {c.unread > 0 && <span className="sr-only">{c.unread} não lidas</span>}
            </Link>
          </li>))}
      </ul>
      <Modal open={open} onClose={() => setOpen(false)} title="Nova conversa" solid>
        {open && (contacts.length === 0 ? <p className="text-sm text-ink-soft">Ninguém disponível ainda. Convide colegas pela página da escola.</p> : (
          <div className="space-y-6">
            <Form action={startDirectAction}>
              <div className="field"><label htmlFor="to">Conversar com</label><select id="to" name="to" className="input" defaultValue=""><option value="" disabled>Escolha…</option>{contacts.map((c) => <option key={c.userId} value={c.userId}>{c.name} — {c.detail}</option>)}</select></div>
              <SubmitButton>Abrir conversa</SubmitButton></Form>
            <Form action={createGroupAction}>
              <h3 className="mb-2 text-base">Grupo da equipe</h3>
              <div className="field"><label htmlFor="title">Nome do grupo</label><input id="title" name="title" className="input" /></div>
              <fieldset className="field"><legend className="mb-1 text-sm font-semibold">Participantes</legend>{contacts.map((c) => <label key={c.userId} className="flex items-center gap-2 py-1 font-normal"><input type="checkbox" name="members" value={c.userId} />{c.name} <span className="hint">· {c.detail}</span></label>)}</fieldset>
              <SubmitButton>Criar grupo</SubmitButton></Form>
          </div>))}
      </Modal>
    </div>
  );
}
