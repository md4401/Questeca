import Link from "next/link";
import { and, eq, desc, or, ilike } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { materials, classes } from "@/db/schema";
import { visibleClasses } from "@/lib/access";
import { Form, Field, SubmitButton } from "@/components/form";
import { addMaterialAction, deleteMaterialAction, useAsTheoryAction, approveMaterialAction } from "./actions";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Materiais" };
const VIS: Record<string, string> = { private: "Só eu", class: "Alunos da turma", school: "Professores da escola" };
const KIND: Record<string, string> = { didatico: "Material didático", teoria: "Teoria de referência", planejamento: "Planejamento", prova_exportada: "Prova exportada", outro: "Outro" };

export default async function Materiais({ searchParams }: { searchParams: Promise<{ tipo?: string; turma?: string; tag?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const cls = await visibleClasses(ctx);
  const rows = await db.select({ m: materials, cname: classes.name }).from(materials).leftJoin(classes, eq(classes.id, materials.classId))
    .where(and(eq(materials.orgId, ctx.org.id), or(eq(materials.ownerId, ctx.user.id), and(eq(materials.visibility, "school"), eq(materials.approval, "approved"))), sp.tag ? ilike(materials.title, `%${sp.tag}%`) : undefined, sp.tipo ? eq(materials.kind, sp.tipo) : undefined, sp.turma ? eq(materials.classId, sp.turma) : undefined)).orderBy(desc(materials.createdAt));
  const manager = ctx.org.role === "coordinator" || ctx.org.role === "admin";
  const pending = manager ? rows.filter((r) => r.m.approval === "pending") : [];
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <h1 className="mb-1">Materiais</h1>
        <p className="hint mb-4">Documentos de referência, planejamentos, provas exportadas e materiais salvos. Ficam privados na escola/contexto ativo.</p>
        <form className="card mb-4 flex flex-wrap items-end gap-3"><div className="field mb-0"><label htmlFor="tipo">Tipo</label><select id="tipo" name="tipo" defaultValue={sp.tipo ?? ""} className="input"><option value="">Todos</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field mb-0"><label htmlFor="turma">Turma</label><select id="turma" name="turma" defaultValue={sp.turma ?? ""} className="input"><option value="">Todas</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><button className="btn" type="submit">Filtrar</button></form>
        {pending.length > 0 && <section className="card-amber mb-4"><h2 className="mb-2 text-lg">Aguardando aprovação ({pending.length})</h2><ul className="space-y-2 text-sm">{pending.map(({ m }) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2"><span>{m.title} <span className="hint">· {VIS[m.visibility]}</span></span><span className="flex gap-3"><form action={approveMaterialAction.bind(null, m.id, true)}><button className="link-btn" type="submit">Aprovar</button></form><form action={approveMaterialAction.bind(null, m.id, false)}><button className="link-btn text-danger" type="submit">Rejeitar</button></form></span></li>)}</ul></section>}
        <ul className="space-y-3">{rows.map(({ m, cname }) => (
          <li key={m.id} className="card"><p className="text-xs font-bold text-ink-soft">{KIND[m.kind]}{cname ? ` · ${cname}` : ""} · {fmtDateTime(m.createdAt)} · {VIS[m.visibility]}{m.approval !== "approved" ? ` · ${m.approval === "pending" ? "aguardando aprovação" : "rejeitado"}` : ""}{m.ownerId !== ctx.user.id ? " · biblioteca da escola" : ""}</p><h2 className="text-lg">{m.title}</h2>{m.description && <p className="text-sm">{m.description}</p>}{m.tags.length > 0 && <p className="hint">{m.tags.map((x) => `#${x}`).join(" ")}</p>}
            {m.text && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{m.text}</p>}
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              {m.text && m.ownerId === ctx.user.id && <form action={useAsTheoryAction.bind(null, m.id)}><button className="link-btn" type="submit">Usar como teoria (nova prova)</button></form>}
              {m.file && <a href={`/api/material/${m.id}`}>Baixar arquivo ({m.downloads} download(s))</a>}{m.url && <a href={m.url} target="_blank" rel="noreferrer noopener">Abrir link</a>}
              {m.classId && <Link href={`/app/turmas/${m.classId}/avaliacoes`}>Registrar prova existente</Link>}
              {m.ownerId === ctx.user.id && <form action={deleteMaterialAction.bind(null, m.id)}><button className="link-btn text-danger" type="submit">Excluir</button></form>}</div></li>))}
          {rows.length === 0 && <li className="card text-ink-soft">Nenhum material. Adicione ao lado ou salve a partir da Comunidade.</li>}</ul>
      </div>
      <section className="card h-fit"><h2 className="mb-2 text-lg">Adicionar material</h2>
        <Form action={addMaterialAction} resetOnOk>
          <Field label="Título" name="title" />
          <div className="field"><label htmlFor="kind">Tipo</label><select id="kind" name="kind" className="input">{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field"><label htmlFor="classId">Turma (opcional)</label><select id="classId" name="classId" className="input"><option value="">—</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label htmlFor="visibility">Compartilhar com</label><select id="visibility" name="visibility" className="input" defaultValue="private"><option value="private">Só eu</option><option value="class">Alunos da turma escolhida</option><option value="school">Professores da escola</option></select></div>
          <Field label="Disciplina (opcional)" name="subject" />
          <Field label="Etiquetas (separadas por vírgula)" name="tags" />
          <div className="field"><label htmlFor="description">Descrição</label><input id="description" name="description" className="input" /></div>
          <Field label="Link (opcional)" name="url" placeholder="https://" />
          <div className="field"><label htmlFor="text">Texto</label><textarea id="text" name="text" className="input" /></div>
          <div className="field"><label htmlFor="file">Ou arquivo (PDF, DOCX, TXT, imagem…)</label><input id="file" name="file" type="file" className="input" /></div>
          <SubmitButton>Salvar</SubmitButton></Form></section>
    </div>
  );
}
