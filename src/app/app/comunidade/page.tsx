import Link from "next/link";
import { and, eq, desc, or, isNull, inArray, sql } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { posts, users, comments, savedPosts, orgs } from "@/db/schema";
import { Form, Field, SubmitButton } from "@/components/form";
import { createPostAction } from "./actions";
import { fmtDateTime } from "@/lib/format";
import { normalize, GRADES } from "@/lib/taxonomy";

export const metadata = { title: "Comunidade" };
const KINDS: Record<string, string> = { duvida: "Dúvida", material: "Material", pratica: "Prática de sala", avaliacao: "Avaliação" };

export default async function Comunidade({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string; esc?: string; salvos?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const myOrgIds = ctx.orgs.map((o) => o.id);
  const scope = sp.esc === "escola" ? and(eq(posts.orgId, ctx.org.id)) : sp.esc === "geral" ? isNull(posts.orgId) : or(isNull(posts.orgId), inArray(posts.orgId, myOrgIds));
  const rows = await db.select({ p: posts, author: users.name, orgName: orgs.name, nComments: sql<number>`(select count(*) from ${comments} c where c.post_id = ${posts.id} and c.hidden = false)` })
    .from(posts).innerJoin(users, eq(users.id, posts.authorId)).leftJoin(orgs, eq(orgs.id, posts.orgId))
    .where(and(eq(posts.hidden, false), scope, sp.tipo ? eq(posts.kind, sp.tipo) : undefined)).orderBy(desc(posts.createdAt)).limit(100);
  const saved = new Set((await db.select({ id: savedPosts.postId }).from(savedPosts).where(eq(savedPosts.userId, ctx.user.id))).map((s) => s.id));
  const q = normalize(sp.q ?? "");
  const list = rows.filter((r) => (!q || normalize(`${r.p.title} ${r.p.body}`).includes(q)) && (!sp.salvos || saved.has(r.p.id)));
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <h1 className="mb-1">Comunidade de professores</h1>
        <p className="hint mb-4">Troque dúvidas, práticas e materiais autorizados. Antes de publicar você escolhe o público. Notas, provas respondidas e dados de alunos não podem ser publicados.</p>
        <form className="card mb-4 flex flex-wrap items-end gap-3" role="search">
          <div className="field mb-0"><label htmlFor="q">Buscar</label><input id="q" name="q" defaultValue={sp.q} className="input" /></div>
          <div className="field mb-0"><label htmlFor="tipo">Tipo</label><select id="tipo" name="tipo" defaultValue={sp.tipo ?? ""} className="input"><option value="">Todos</option>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field mb-0"><label htmlFor="esc">Público</label><select id="esc" name="esc" defaultValue={sp.esc ?? ""} className="input"><option value="">Tudo que posso ver</option><option value="geral">Mural geral</option>{ctx.org.kind === "school" && <option value="escola">Só da escola ativa</option>}</select></div>
          <label className="flex gap-2 pb-2 font-normal"><input type="checkbox" name="salvos" value="1" defaultChecked={!!sp.salvos} />Só salvos</label>
          <button className="btn" type="submit">Filtrar</button>
        </form>
        <ul className="space-y-3">
          {list.map(({ p, author, orgName, nComments }) => (
            <li key={p.id} className="card">
              <p className="text-xs font-bold text-ink-soft">{KINDS[p.kind] ?? p.kind} · {p.orgId ? <span className="badge badge-amber">Privado: {orgName}</span> : <span className="badge">Mural geral</span>}{saved.has(p.id) && <span className="badge badge-gray ml-1">salvo</span>}</p>
              <h2 className="text-lg"><Link href={`/app/comunidade/${p.id}`}>{p.title}</Link></h2>
              <p className="mt-1 line-clamp-3 text-sm">{p.body}</p>
              <p className="hint mt-2">{author} · {fmtDateTime(p.createdAt)} · {Number(nComments)} comentário(s){p.attachmentName ? " · com anexo" : ""}</p>
            </li>))}
          {list.length === 0 && <li className="card text-ink-soft">Nada por aqui ainda. Comece uma conversa ao lado.</li>}
        </ul>
      </div>
      <aside>
        <section className="card" aria-labelledby="np"><h2 id="np" className="mb-2 text-lg">Nova publicação</h2>
          <Form action={createPostAction} resetOnOk>
            <Field label="Título" name="title" required />
            <div className="field"><label htmlFor="body">Mensagem</label><textarea id="body" name="body" required className="input" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="field"><label htmlFor="kind">Tipo</label><select id="kind" name="kind" className="input">{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="field"><label htmlFor="grade">Série</label><select id="grade" name="grade" className="input"><option value="">—</option>{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
            </div>
            <fieldset className="field"><legend className="label">Quem pode ver?</legend>
              <label className="flex gap-2 font-normal"><input type="radio" name="audience" value="general" defaultChecked />Mural geral (professores da Questeca)</label>
              {ctx.org.kind === "school" && <label className="flex gap-2 font-normal"><input type="radio" name="audience" value="school" />Somente colegas de {ctx.org.name}</label>}</fieldset>
            <div className="field"><label htmlFor="attachment">Anexo (opcional, até 3 MB)</label><input id="attachment" name="attachment" type="file" className="input" />
              <label className="flex gap-2 font-normal text-sm"><input type="checkbox" name="confirmAnon" />Confirmo que o anexo não contém nomes, fotos ou dados de estudantes.</label></div>
            <SubmitButton>Publicar</SubmitButton></Form></section>
      </aside>
    </div>
  );
}
