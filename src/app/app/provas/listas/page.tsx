import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { Form, SubmitButton } from "@/components/form";
import { GRADES, SUBJECTS } from "@/lib/taxonomy";
import { criarListasABAction } from "./actions";

export const metadata = { title: "Lista A/B" };
export default async function Listas() {
  const ctx = await requireCtx(); const classes = await visibleClasses(ctx);
  return (
    <div className="max-w-2xl">
      <h1>Lista de exercícios A/B</h1>
      <p className="hint mb-4">As mesmas questões em duas versões: a B vem com as questões embaralhadas, uma para cada fileira, para reduzir cola. Cada uma abre no editor, com gabarito, e pode ser impressa.</p>
      <Form action={criarListasABAction} className="card">
        <div className="field"><label htmlFor="themes">Temas</label><textarea id="themes" name="themes" className="input" style={{ minHeight: 80 }} placeholder="Ex.: funções do 2º grau, porcentagem" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="field"><label htmlFor="subject">Disciplina</label><select id="subject" name="subject" className="input" defaultValue="todas"><option value="todas">Todas</option>{SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
          <div className="field"><label htmlFor="grade">Série</label><select id="grade" name="grade" className="input" defaultValue="9">{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
          <div className="field"><label htmlFor="count">Questões em cada lista</label><input id="count" name="count" type="number" min={2} max={25} defaultValue={5} className="input" /></div>
          <div className="field"><label htmlFor="classId">Turma (opcional)</label><select id="classId" name="classId" className="input" defaultValue=""><option value="">Sem turma</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <div className="field"><label htmlFor="title">Nome (opcional)</label><input id="title" name="title" className="input" /></div>
        <SubmitButton>Criar listas A e B</SubmitButton>
      </Form>
    </div>
  );
}
