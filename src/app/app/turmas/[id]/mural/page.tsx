import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { Form, SubmitButton } from "@/components/form";
import { MuralFeed } from "@/components/mural";
import { createPostAction } from "@/lib/mural-actions";

export const metadata = { title: "Mural da turma" };

export default async function Mural({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, id);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div><MuralFeed classIds={[id]} orgId={cls.orgId} viewer="staff" userId={ctx.user.id} /></div>
      <section className="card h-fit"><h2 className="mb-1 text-lg">Nova publicação</h2>
        <p className="hint mb-3">Visível para os alunos e responsáveis com acesso ao portal. Alunos comentam; responsáveis só leem.</p>
        <Form action={createPostAction.bind(null, id)} resetOnOk>
          <div className="field"><label htmlFor="kind">Tipo</label><select id="kind" name="kind" className="input"><option value="aviso">Aviso</option><option value="atividade">Atividade</option><option value="recurso">Recurso</option><option value="formulario">Formulário</option></select></div>
          <div className="field"><label htmlFor="title">Título (opcional)</label><input id="title" name="title" className="input" /></div>
          <div className="field"><label htmlFor="body">Texto</label><textarea id="body" name="body" className="input" style={{ minHeight: 100 }} /></div>
          <div className="field"><label htmlFor="linkUrl">Link (opcional)</label><input id="linkUrl" name="linkUrl" className="input" placeholder="https://" /></div>
          <div className="field"><label htmlFor="file">Arquivo (até 4 MB)</label><input id="file" name="file" type="file" className="input" /></div>
          <SubmitButton>Publicar</SubmitButton></Form></section>
    </div>
  );
}
