import { Form, Field, SubmitButton } from "@/components/form";
import { createClassAction, createDemoClassAction } from "../turmas/actions";
import { GRADES } from "@/lib/taxonomy";
import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { redirect } from "next/navigation";

export const metadata = { title: "Primeiros passos" };

export default async function PrimeirosPassos() {
  const ctx = await requireCtx();
  const existing = await visibleClasses(ctx);
  if (existing.length) redirect("/app");
  return (
    <div className="max-w-xl">
      <h1>Vamos preparar sua primeira prova</h1>
      <p className="hint mb-4">Escola: <strong>{ctx.org.name}</strong>. Você pode começar sem cadastrar alunos.</p>
      <Form action={createClassAction} className="card">
        <input type="hidden" name="next" value="prova" />
        <input type="hidden" name="subject" value="matematica" />
        <h2 className="mb-3 text-lg">Disciplina e turma</h2>
        <p className="hint mb-3">Disciplina: Matemática (nesta fase do piloto).</p>
        <div className="field"><label htmlFor="grade">Ano/série</label>
          <select id="grade" name="grade" className="input" defaultValue="9">{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
        <Field label="Identificação da primeira turma" name="name" required placeholder="9º B" />
        <SubmitButton>Criar primeira prova</SubmitButton>
      </Form>
      <form action={createDemoClassAction} className="mt-4">
        <p className="hint mb-2">Só quer avaliar a ferramenta?</p>
        <SubmitButton className="btn btn-ghost">Usar turma de exemplo identificada</SubmitButton>
      </form>
    </div>
  );
}
