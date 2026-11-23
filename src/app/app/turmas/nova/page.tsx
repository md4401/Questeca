import { SUBJECTS } from "@/lib/taxonomy";
import { Form, Field, SubmitButton } from "@/components/form";
import { createClassAction } from "../actions";
import { GRADES } from "@/lib/taxonomy";

export const metadata = { title: "Nova turma" };

export default function NovaTurma() {
  return (
    <div className="max-w-xl">
      <h1>Nova turma</h1>
      <p className="hint mb-4">O mínimo para distinguir escola, ano letivo, série, grupo e disciplina. A lista de alunos vem depois.</p>
      <Form action={createClassAction} className="card">
        <Field label="Identificação da turma" name="name" required placeholder="9º B" />
        <div className="field"><label htmlFor="grade">Ano/série</label>
          <select id="grade" name="grade" className="input" required defaultValue="9">{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
        <div className="field"><label htmlFor="subject">Disciplina</label><select id="subject" name="subject" className="input">{SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          <span className="hint">Outras disciplinas entram na fase de expansão.</span></div>
        <Field label="Ano letivo" name="year" type="number" defaultValue={new Date().getFullYear()} min={2020} max={2100} />
        <SubmitButton>Criar turma</SubmitButton>
      </Form>
    </div>
  );
}
