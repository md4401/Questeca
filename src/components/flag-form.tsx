"use client";
import { useState } from "react";
import { flagQuestionAction } from "@/app/app/banco/actions";

export function FlagForm({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  if (msg) return <span className="ok text-sm">{msg}</span>;
  if (!open) return <button type="button" className="link-btn" onClick={() => setOpen(true)}>Denunciar erro ou direito autoral</button>;
  return (
    <form className="flex flex-wrap items-center gap-2 text-sm" action={async (fd) => { const r = await flagQuestionAction(questionId, fd); setMsg(r.ok ?? r.error ?? ""); }}>
      <label className="sr-only" htmlFor={`r-${questionId}`}>Motivo</label>
      <select id={`r-${questionId}`} name="reason" className="input" style={{ width: 200, minHeight: 34 }}><option value="gabarito">Gabarito parece errado</option><option value="enunciado">Erro no enunciado</option><option value="direito">Direito autoral</option><option value="outro">Outro</option></select>
      <input name="detail" className="input" style={{ width: 220, minHeight: 34 }} placeholder="Detalhe (opcional)" aria-label="Detalhe" />
      <button className="btn btn-sm" type="submit">Enviar</button>
    </form>
  );
}
