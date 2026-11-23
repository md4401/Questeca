import Link from "next/link";
import { and, eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { materials, classes } from "@/db/schema";
import { visibleClasses } from "@/lib/access";
import { Form, Field, SubmitButton } from "@/components/form";
import { addMaterialAction, deleteMaterialAction, useAsTheoryAction } from "./actions";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Materiais" };
const KIND: Record<string, string> = { teoria: "Teoria de referência", planejamento: "Planejamento", prova_exportada: "Prova exportada", outro: "Outro" };

export default async function Materiais({ searchParams }: { searchParams: Promise<{ tipo?: string; turma?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const cls = await visibleClasses(ctx);
  const rows = await db.select({ m: materials, cname: classes.name }).from(materials).leftJoin(classes, eq(classes.id, materials.classId))
    .where(and(eq(materials.orgId, ctx.org.id), eq(materials.ownerId, ctx.user.id), sp.tipo ? eq(materials.kind, sp.tipo) : undefined, sp.turma ? eq(materials.classId, sp.turma) : undefined)).orderBy(desc(materials.createdAt));
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <h1 className="mb-1">Materiais</h1>
        <p className="hint mb-4">Documentos de referência, planejamentos, provas exportadas e materiais salvos. Ficam privados na escola/contexto ativo.</p>
        <form className="card mb-4 flex flex-wrap items-end gap-3"><div className="field mb-0"><label htmlFor="tipo">Tipo</label><select id="tipo" name="tipo" defaultValue={sp.tipo ?? ""} className="input"><option value="">Todos</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field mb-0"><label htmlFor="turma">Turma</label><select id="turma" name="turma" defaultValue={sp.turma ?? ""} className="input"><option value="">Todas</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><button className="btn" type="submit">Filtrar</button></form>
        <ul className="space-y-3">{rows.map(({ m, cname }) => (
          <li key={m.id} className="card"><p className="text-xs font-bold text-ink-soft">{KIND[m.kind]}{cname ? ` · ${cname}` : ""} · {fmtDateTime(m.createdAt)}</p><h2 className="text-lg">{m.title}</h2>
            {m.text && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{m.text}</p>}
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              {m.text && <form action={useAsTheoryAction.bind(null, m.id)}><button className="link-btn" type="submit">Usar como teoria (nova prova)</button></form>}
              {m.file && <a href={`/api/material/${m.id}`}>Baixar arquivo</a>}
              {m.classId && <Link href={`/app/turmas/${m.classId}/avaliacoes`}>Registrar prova existente</Link>}
              <form action={deleteMaterialAction.bind(null, m.id)}><button className="link-btn text-danger" type="submit">Excluir</button></form></div></li>))}
          {rows.length === 0 && <li className="card text-ink-soft">Nenhum material. Adicione ao lado ou salve a partir da Comunidade.</li>}</ul>
      </div>
      <section className="card h-fit"><h2 className="mb-2 text-lg">Adicionar material</h2>
        <Form action={addMaterialAction} resetOnOk>
          <Field label="Título" name="title" />
          <div className="field"><label htmlFor="kind">Tipo</label><select id="kind" name="kind" className="input">{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field"><label htmlFor="classId">Turma (opcional)</label><select id="classId" name="classId" className="input"><option value="">—</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label htmlFor="text">Texto</label><textarea id="text" name="text" className="input" /></div>
          <div className="field"><label htmlFor="file">Ou arquivo (PDF, DOCX, TXT)</label><input id="file" name="file" type="file" className="input" /></div>
          <SubmitButton>Salvar</SubmitButton></Form></section>
    </div>
  );
}
