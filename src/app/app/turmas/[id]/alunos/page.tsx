import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { Form, Field, SubmitButton } from "@/components/form";
import { addStudentAction, removeStudentAction } from "../../actions";
import { StudentImport } from "@/components/student-import";

export const metadata = { title: "Alunos" };

export default async function Alunos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const list = await classStudents(id);
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="card">
        <h2 className="mb-3">Alunos ({list.length})</h2>
        {list.length === 0 ? <p className="text-ink-soft">Nenhum aluno ainda. Você pode criar e corrigir provas sem lista nominal; cadastre quando for lançar notas.</p> : (
          <table className="t"><thead><tr><th>Nome</th><th>Matrícula</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
            {list.map((s) => (
              <tr key={s.id}><td>{s.name}</td><td>{s.registration ?? "—"}</td>
                <td className="whitespace-nowrap">
                  <form action={removeStudentAction.bind(null, id, s.id, "transferred")} className="inline"><button className="link-btn" type="submit">Marcar transferido</button></form>{" · "}
                  <form action={removeStudentAction.bind(null, id, s.id, "remove")} className="inline"><button className="link-btn text-danger" type="submit" aria-label={`Remover ${s.name} da turma`}>Remover</button></form>
                </td></tr>))}
          </tbody></table>)}
      </section>
      <div className="space-y-6">
        <section className="card"><h2 className="mb-2 text-lg">Adicionar um aluno</h2>
          <Form action={addStudentAction.bind(null, id)} resetOnOk>
            <Field label="Nome" name="name" required /><Field label="Matrícula ou identificador (opcional)" name="registration" />
            <label className="mb-3 flex gap-2 font-normal text-sm"><input type="checkbox" name="confirmHomonym" />É outra pessoa (confirmar homônimo)</label>
            <SubmitButton>Adicionar</SubmitButton></Form></section>
        <StudentImport classId={id} />
      </div>
    </div>
  );
}
