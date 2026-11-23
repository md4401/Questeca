import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { Form, Field, SubmitButton } from "@/components/form";
import { createDraftAction } from "../actions";
import { gradeLabel } from "@/lib/taxonomy";
import { aiAvailable } from "@/lib/ai";

export const metadata = { title: "Nova prova" };

export default async function NovaProva({ searchParams }: { searchParams: Promise<{ turma?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const classes = await visibleClasses(ctx);
  return (
    <div className="max-w-2xl">
      <h1>Nova prova</h1>
      <p className="hint mb-4">Passo 1 de 3 · Conteúdo estudado. Depois você confirma o que será cobrado antes de buscar as questões.</p>
      <Form action={createDraftAction} className="card">
        <Field label="Título da prova" name="title" placeholder="Prova de porcentagem" />
        <div className="field"><label htmlFor="classId">Para qual turma?</label>
          <select id="classId" name="classId" className="input" defaultValue={sp.turma ?? ""}>
            <option value="">Sem turma (definir depois)</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name} — {gradeLabel(c.grade)}</option>)}
          </select>
          {classes.length === 0 && <span className="hint">Você ainda não tem turma. <Link href="/app/turmas/nova">Criar turma</Link></span>}</div>
        <div className="field"><label htmlFor="text">O que a turma estudou?</label>
          <textarea id="text" name="text" className="input" style={{ minHeight: 140 }} placeholder="Ex.: Matemática, 9º B. Ensinei porcentagem simples e descontos sucessivos. Ainda não trabalhei juros compostos." />
          <span className="hint">Cole texto, anotações ou o planejamento. Exclusões como “ainda não ensinei X” são reconhecidas.</span></div>
        <div className="field"><label htmlFor="file">Ou envie o material (PDF, DOCX, TXT{aiAvailable() ? " ou foto" : ""})</label><input id="file" name="file" type="file" accept=".pdf,.docx,.txt,.md,image/*" className="input" /></div>
        <label className="mb-4 flex gap-2 font-normal"><input type="checkbox" name="useLog" defaultChecked />Incluir conteúdos registrados no diário desta turma como pré-requisitos sugeridos</label>
        <SubmitButton pendingLabel="Lendo o material…">Continuar</SubmitButton>
      </Form>
    </div>
  );
}
