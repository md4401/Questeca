"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Form, Field, SubmitButton, type FormState } from "@/components/form";
import { addMaterialAction } from "./actions";

const KIND: Record<string, string> = { didatico: "Material didático", teoria: "Teoria de referência", planejamento: "Planejamento", prova_exportada: "Prova exportada", outro: "Outro" };

/** Botão "Adicionar material" que abre o formulário num modal; fecha ao salvar. */
export function NovoMaterial({ classes }: { classes: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const acao = async (prev: FormState, fd: FormData) => { const r = await addMaterialAction(prev, fd); if (r?.ok) setOpen(false); return r; };
  return (
    <>
      <button type="button" className="btn btn-sm" onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="adicionar-material">Adicionar material</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Adicionar material" solid>
        {open && (
          <Form action={acao} resetOnOk toast>
            <Field label="Título" name="title" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="field"><label htmlFor="kind">Tipo</label><select id="kind" name="kind" className="input">{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="field"><label htmlFor="classId">Turma (opcional)</label><select id="classId" name="classId" className="input"><option value="">—</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="field"><label htmlFor="visibility">Compartilhar com</label><select id="visibility" name="visibility" className="input" defaultValue="private"><option value="private">Só eu</option><option value="school">Professores da escola</option></select></div>
              <Field label="Disciplina (opcional)" name="subject" />
            </div>
            <Field label="Etiquetas (separadas por vírgula)" name="tags" />
            <div className="field"><label htmlFor="description">Descrição</label><input id="description" name="description" className="input" /></div>
            <Field label="Link (opcional)" name="url" placeholder="https://" />
            <div className="field"><label htmlFor="text">Texto</label><textarea id="text" name="text" className="input" /></div>
            <div className="field"><label htmlFor="file">Ou arquivo (PDF, DOCX, TXT, imagem…)</label><input id="file" name="file" type="file" className="input" /></div>
            <div className="flex flex-wrap items-center gap-3"><SubmitButton>Salvar</SubmitButton><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button></div>
          </Form>)}
      </Modal>
    </>
  );
}
