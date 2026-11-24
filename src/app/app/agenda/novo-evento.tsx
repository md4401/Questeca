"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Form, SubmitButton, type FormState } from "@/components/form";
import { createEventAction } from "./actions";

/** Botão "Adicionar evento" (canto superior direito da Agenda) que abre o formulário num modal; fecha ao criar. */
export function NovoEvento({ classes, canSchool, defaultDate, label = "Adicionar evento", className = "btn btn-sm", testId = "adicionar-evento" }: { classes: { id: string; name: string }[]; canSchool: boolean; defaultDate: string; label?: string; className?: string; testId?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) { const id = setTimeout(() => document.getElementById("title")?.focus(), 0); return () => clearTimeout(id); } }, [open]);
  const acao = async (prev: FormState, fd: FormData) => { const r = await createEventAction(prev, fd); if (r?.ok) setOpen(false); return r; };
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid={testId}>{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo evento" solid>
        {open && (
          <Form action={acao} toast>
            <div className="field"><label htmlFor="title">Título</label><input id="title" name="title" className="input" required /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="field"><label htmlFor="category">Categoria</label><select id="category" name="category" className="input"><option value="evento">Evento</option><option value="prova">Prova</option><option value="trabalho">Trabalho</option><option value="atividade">Atividade</option><option value="reuniao">Reunião</option><option value="feriado">Feriado</option></select></div>
              <div className="field"><label htmlFor="scope">Para quem</label><select id="scope" name="scope" className="input" defaultValue="personal"><option value="personal">Só para mim</option><option value="class">Uma turma</option>{canSchool && <option value="school">Toda a escola</option>}</select></div>
            </div>
            <div className="field"><label htmlFor="classId">Turma (se for de turma)</label><select id="classId" name="classId" className="input" defaultValue=""><option value="">—</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="field"><label htmlFor="date">Data</label><input id="date" name="date" type="date" className="input" required defaultValue={defaultDate} /></div>
              <div className="field"><label htmlFor="startTime">Início</label><input id="startTime" name="startTime" type="time" className="input" /></div>
              <div className="field"><label htmlFor="endTime">Término</label><input id="endTime" name="endTime" type="time" className="input" /></div>
            </div>
            <label className="mb-3 flex gap-2 font-normal"><input type="checkbox" name="allDay" />Dia todo</label>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="field"><label htmlFor="freq">Repetir</label><select id="freq" name="freq" className="input" defaultValue="none"><option value="none">Não repete</option><option value="daily">Todo dia</option><option value="weekly">Toda semana</option><option value="monthly">Todo mês</option></select></div>
              <div className="field"><label htmlFor="until">Até</label><input id="until" name="until" type="date" className="input" /></div>
              <div className="field"><label htmlFor="reminder">Lembrete</label><select id="reminder" name="reminder" className="input" defaultValue=""><option value="">Sem lembrete</option><option value="30">30 min antes</option><option value="60">1 h antes</option><option value="1440">1 dia antes</option></select></div>
            </div>
            <div className="flex flex-wrap items-center gap-3"><SubmitButton>Criar evento</SubmitButton><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button></div>
          </Form>)}
        <p className="hint mt-3">Lembretes aparecem nas notificações quando você abre a Questeca perto do horário (não há envio automático por e-mail ou push).</p>
      </Modal>
    </>
  );
}
