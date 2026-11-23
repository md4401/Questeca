"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Form, Field, SubmitButton } from "@/components/form";
import { demoRequestAction } from "@/app/(public)/escolas/actions";

/** Botão que abre o pedido de demonstração em modal; a confirmação chega por toast. */
export function DemoButton({ label = "Agendar demonstração", className = "btn btn-glass btn-lg" }: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Demonstração para escolas">
        <p className="mb-4 text-ink-soft">Mostramos o fluxo com dados de exemplo e combinamos um piloto com uma turma, um responsável e como medir tempo de trabalho.</p>
        <Form action={async (p, fd) => { const r = await demoRequestAction(p, fd); if (r?.ok) setTimeout(() => setOpen(false), 600); return r; }} toast resetOnOk>
          <Field label="Seu nome" name="name" id="demo-name" required autoComplete="name" />
          <Field label="E-mail" name="email" id="demo-email" type="email" required autoComplete="email" />
          <Field label="Escola" name="school" id="demo-school" required />
          <div className="field"><label htmlFor="demo-message">O que você quer ver? (opcional)</label><textarea id="demo-message" name="message" className="input" /></div>
          <SubmitButton pendingLabel="Enviando…">Pedir demonstração</SubmitButton>
        </Form>
      </Modal>
    </>
  );
}
