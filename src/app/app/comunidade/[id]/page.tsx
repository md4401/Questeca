import Link from "next/link";
import { and, eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { posts, users, comments, savedPosts, orgs } from "@/db/schema";
import { Form, SubmitButton } from "@/components/form";
import { commentAction, editPostAction, toggleSaveAction, flagPostAction, saveToMaterialsAction } from "../actions";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Publicação" };

export default async function Post({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db.select({ p: posts, author: users.name, orgName: orgs.name }).from(posts).innerJoin(users, eq(users.id, posts.authorId)).leftJoin(orgs, eq(orgs.id, posts.orgId)).where(eq(posts.id, id)).limit(1);
  if (!row || row.p.hidden) notFound();
  if (row.p.orgId && !ctx.orgs.some((o) => o.id === row.p.orgId)) notFound(); // outra escola: indisponível
  const cs = await db.select({ c: comments, author: users.name }).from(comments).innerJoin(users, eq(users.id, comments.authorId)).where(and(eq(comments.postId, id), eq(comments.hidden, false))).orderBy(asc(comments.createdAt));
  const [saved] = await db.select().from(savedPosts).where(and(eq(savedPosts.userId, ctx.user.id), eq(savedPosts.postId, id))).limit(1);
  const mine = row.p.authorId === ctx.user.id;
  return (
    <div className="max-w-3xl">
      <p className="hint"><Link href="/app/comunidade">Comunidade</Link></p>
      <h1>{row.p.title}</h1>
      <p className="hint mb-4">{row.author} · {fmtDateTime(row.p.createdAt)} · {row.p.orgId ? <span className="badge badge-amber">Privado: {row.orgName}</span> : <span className="badge">Mural geral</span>}</p>
      <article className="card"><p className="whitespace-pre-line">{row.p.body}</p>
        {row.p.attachmentName && <p className="mt-3 text-sm">Anexo: <a href={`/api/post-file/${id}`}>{row.p.attachmentName}</a></p>}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <form action={toggleSaveAction.bind(null, id)}><button className="link-btn" type="submit">{saved ? "Remover dos salvos" : "Salvar"}</button></form>
          <form action={saveToMaterialsAction.bind(null, id)}><button className="link-btn" type="submit">Reutilizar em Materiais</button></form>
          <details><summary className="link-btn cursor-pointer">Denunciar</summary>
            <Form action={flagPostAction.bind(null, id, null)} className="mt-2"><select name="reason" className="input" aria-label="Motivo"><option value="dados_alunos">Expõe dados de estudantes</option><option value="direitos">Violação de direitos autorais</option><option value="conduta">Conduta inadequada</option><option value="outro">Outro</option></select><SubmitButton className="btn btn-sm mt-2">Enviar denúncia</SubmitButton></Form></details>
        </div></article>
      {mine && <details className="card mt-4"><summary className="cursor-pointer font-bold">Editar publicação</summary><Form action={editPostAction.bind(null, id)} className="mt-3"><textarea name="body" defaultValue={row.p.body} className="input" /><SubmitButton>Salvar</SubmitButton></Form></details>}
      <section className="mt-6"><h2 className="mb-2 text-lg">Comentários ({cs.length})</h2>
        <ul className="space-y-2">{cs.map(({ c, author }) => <li key={c.id} className="card text-sm"><p className="hint">{author} · {fmtDateTime(c.createdAt)}</p><p className="whitespace-pre-line">{c.body}</p>
          <details className="mt-1"><summary className="link-btn cursor-pointer">Denunciar</summary><Form action={flagPostAction.bind(null, id, c.id)}><select name="reason" className="input" aria-label="Motivo"><option value="dados_alunos">Expõe dados de estudantes</option><option value="conduta">Conduta inadequada</option><option value="outro">Outro</option></select><SubmitButton className="btn btn-sm mt-2">Enviar</SubmitButton></Form></details></li>)}</ul>
        <Form action={commentAction.bind(null, id)} className="card mt-3" resetOnOk><div className="field"><label htmlFor="body">Responder</label><textarea id="body" name="body" required className="input" /></div><SubmitButton>Comentar</SubmitButton></Form></section>
    </div>
  );
}
