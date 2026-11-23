import { desc, eq, inArray, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { classPosts, classComments, users, taskAttachments, classes } from "@/db/schema";
import { Form, SubmitButton } from "@/components/form";
import { commentAction, deleteCommentAction, reportCommentAction, pinPostAction, deletePostAction } from "@/lib/mural-actions";
import { fmtDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/core/permissions";
import { memberships } from "@/db/schema";
import { anyOf } from "@/lib/portal";

const KIND: Record<string, string> = { aviso: "Aviso", atividade: "Atividade", recurso: "Recurso", formulario: "Formulário" };

/** Feed do mural de uma ou mais turmas. `viewer`: staff (modera), student (comenta) ou guardian (só lê). */
export async function MuralFeed({ classIds, orgId, viewer, userId }: { classIds: string[]; orgId: string; viewer: "staff" | "student" | "guardian"; userId: string }) {
  const posts = await db.select({ p: classPosts, author: users.name, cname: classes.name }).from(classPosts).innerJoin(users, eq(users.id, classPosts.authorId)).innerJoin(classes, eq(classes.id, classPosts.classId))
    .where(inArray(classPosts.classId, anyOf(classIds))).orderBy(desc(classPosts.pinned), desc(classPosts.createdAt)).limit(40);
  const ids = posts.map((x) => x.p.id);
  const comments = ids.length ? await db.select({ c: classComments, author: users.name, authorId: users.id }).from(classComments).innerJoin(users, eq(users.id, classComments.authorId)).where(and(inArray(classComments.postId, ids), isNull(classComments.deletedAt))).orderBy(classComments.createdAt) : [];
  const files = ids.length ? await db.select({ id: taskAttachments.id, name: taskAttachments.name, postId: taskAttachments.postId }).from(taskAttachments).where(inArray(taskAttachments.postId, ids)) : [];
  const roles = comments.length ? await db.select({ u: memberships.userId, r: memberships.role }).from(memberships).where(and(eq(memberships.orgId, orgId), inArray(memberships.userId, [...new Set(comments.map((c) => c.authorId))]))) : [];
  const roleOf = (u: string) => ROLE_LABEL[(roles.find((r) => r.u === u)?.r ?? "teacher") as keyof typeof ROLE_LABEL];
  if (posts.length === 0) return <p className="card text-ink-soft">Nenhuma publicação ainda.</p>;
  return (
    <ul className="space-y-4">
      {posts.map(({ p, author, cname }) => (
        <li key={p.id}><article className="card" aria-label={p.title ?? "Publicação"}>
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft"><span className="badge">{KIND[p.kind]}</span>{p.pinned && <span className="badge badge-amber">Fixada</span>}<span>{author} · {cname} · {fmtDateTime(p.createdAt)}</span></p>
          {p.title && <h2 className="mt-1 text-lg">{p.title}</h2>}
          <p className="mt-1 whitespace-pre-line">{p.body}</p>
          {p.linkUrl && <p className="mt-2"><a href={p.linkUrl} target="_blank" rel="noreferrer noopener">Abrir link</a></p>}
          {files.filter((f) => f.postId === p.id).map((f) => <p key={f.id} className="mt-1 text-sm"><a href={`/api/anexo/${f.id}`}>{f.name}</a></p>)}
          <p className="hint mt-2">Visível para: alunos e responsáveis de {cname} e a equipe da turma.</p>
          {viewer === "staff" && <div className="mt-2 flex gap-3 text-sm"><form action={pinPostAction.bind(null, p.classId, p.id, !p.pinned)}><button className="link-btn" type="submit">{p.pinned ? "Desafixar" : "Fixar"}</button></form><form action={deletePostAction.bind(null, p.classId, p.id)}><button className="link-btn text-danger" type="submit">Excluir</button></form></div>}
          <div className="mt-3 border-t border-line pt-3">
            <ul className="space-y-2 text-sm">{comments.filter((c) => c.c.postId === p.id).map(({ c, author: a, authorId }) => (
              <li key={c.id}><strong>{a}</strong> <span className="hint">({roleOf(authorId)} · {fmtDateTime(c.createdAt)})</span><br />{c.body}
                <span className="ml-2 inline-flex gap-3">
                  {(authorId === userId || viewer === "staff") && <form action={deleteCommentAction.bind(null, c.id)}><button className="link-btn text-danger" type="submit" aria-label="Excluir comentário">Excluir</button></form>}
                  {authorId !== userId && <form action={reportCommentAction.bind(null, c.id)}><button className="link-btn" type="submit" aria-label="Denunciar comentário">Denunciar</button></form>}
                </span></li>))}</ul>
            {viewer === "guardian" ? <p className="hint mt-2">Responsáveis acompanham o mural; os comentários são dos alunos e da equipe.</p> : (
              <Form action={commentAction.bind(null, p.id)} resetOnOk toast><div className="mt-2 flex gap-2"><label className="sr-only" htmlFor={`c-${p.id}`}>Comentário</label><input id={`c-${p.id}`} name="body" className="input flex-1" placeholder="Escreva um comentário" maxLength={1000} /><SubmitButton className="btn btn-ghost">Enviar</SubmitButton></div></Form>)}
          </div>
        </article></li>))}
    </ul>
  );
}
