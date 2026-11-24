"use client";
import { createContext, useContext, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Form, type FormState } from "@/components/form";

const Fechar = createContext<() => void>(() => {});

/** Botão que abre a chamada num modal. `abrirInicial` mantém o modal aberto depois de trocar a data (a página recarrega). */
export function ChamadaModal({ label, titulo, abrirInicial = false, children }: { label: string; titulo: string; abrirInicial?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(abrirInicial);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="abrir-chamada">{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={titulo} solid>
        <Fechar.Provider value={() => setOpen(false)}>{open && children}</Fechar.Provider>
      </Modal>
    </>
  );
}

/** Formulário da chamada: fecha o modal quando salva com sucesso. */
export function ChamadaForm({ action, children }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; children: React.ReactNode }) {
  const fechar = useContext(Fechar);
  const acao = async (prev: FormState, fd: FormData) => { const r = await action(prev, fd); if (r?.ok) fechar(); return r; };
  return (
    <Form action={acao} toast>
      <div className="chamada-todos"><button type="button" className="btn btn-ghost btn-sm" onClick={(e) => e.currentTarget.closest("form")?.querySelectorAll<HTMLInputElement>('input[type="radio"][value="present"]').forEach((i) => { i.checked = true; })}>Marcar todos presentes</button></div>
      {children}
    </Form>);
}
