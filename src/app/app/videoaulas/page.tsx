import Link from "next/link";
import { desc, eq, and, or } from "drizzle-orm";
import { db } from "@/db";
import { videoLessons, classes } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { Form, Field, SubmitButton } from "@/components/form";
import { createVideoAction, publishVideoAction, deleteVideoAction } from "./actions";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Videoaulas" };

export default async function Videoaulas() {
  const ctx = await requireCtx();
  const cls = await visibleClasses(ctx);
  const rows = await db.select({ v: videoLessons, cname: classes.name }).from(videoLessons).leftJoin(classes, eq(classes.id, videoLessons.classId))
    .where(and(eq(videoLessons.orgId, ctx.org.id), or(eq(videoLessons.authorId, ctx.user.id), eq(videoLessons.published, true)))).orderBy(desc(videoLessons.createdAt));
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-3"><h1>Videoaulas</h1>
        <p className="hint">Cadastre o link do vídeo (YouTube, Vimeo ou outro endereço). Os arquivos de vídeo não são hospedados aqui. Publicadas, aparecem no portal da turma.</p>
        {rows.length === 0 ? <p className="card text-ink-soft">Nenhuma videoaula.</p> : rows.map(({ v, cname }) => (
          <article key={v.id} className="card"><p className="text-xs text-ink-soft">{cname ?? "Toda a escola"}{v.subject ? ` · ${v.subject}` : ""}{v.durationMin ? ` · ${v.durationMin} min` : ""} · {fmtDateTime(v.createdAt)}</p>
            <h2 className="text-lg"><Link href={`/app/videoaulas/${v.id}`}>{v.title}</Link> <span className={`badge align-middle ${v.published ? "" : "badge-gray"}`}>{v.published ? "Publicada" : "Rascunho"}</span></h2>
            {v.description && <p className="text-sm">{v.description}</p>}{v.tags.length > 0 && <p className="hint">{v.tags.map((t) => `#${t}`).join(" ")}</p>}
            <p className="hint mt-1">{v.views} visualização(ões)</p>
            {v.authorId === ctx.user.id && <div className="mt-2 flex gap-4 text-sm"><form action={publishVideoAction.bind(null, v.id, !v.published)}><button className="link-btn" type="submit">{v.published ? "Despublicar" : "Publicar"}</button></form><form action={deleteVideoAction.bind(null, v.id)}><button className="link-btn text-danger" type="submit">Excluir</button></form></div>}
          </article>))}
      </div>
      <section className="card h-fit"><h2 className="mb-2 text-lg">Nova videoaula</h2>
        <Form action={createVideoAction} resetOnOk>
          <Field label="Título" name="title" required /><Field label="Link do vídeo" name="url" placeholder="https://youtu.be/…" required />
          <div className="field"><label htmlFor="classId">Turma (vazio = escola toda)</label><select id="classId" name="classId" className="input" defaultValue=""><option value="">Escola toda</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label htmlFor="description">Descrição</label><textarea id="description" name="description" className="input" /></div>
          <Field label="Disciplina" name="subject" /><Field label="Duração (min)" name="durationMin" type="number" /><Field label="Miniatura (link, opcional)" name="thumbnailUrl" /><Field label="Etiquetas" name="tags" />
          <SubmitButton>Salvar</SubmitButton></Form></section>
    </div>
  );
}
