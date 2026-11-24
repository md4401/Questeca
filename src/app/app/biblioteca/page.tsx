import Link from "next/link";
import { and, eq, desc, or, ilike } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { materials, classes, assessments, assistantFiles } from "@/db/schema";
import { visibleClasses } from "@/lib/access";
import { NovoMaterial } from "./novo-material";
import { deleteMaterialAction, useAsTheoryAction, approveMaterialAction } from "./actions";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Biblioteca" };
const VIS: Record<string, string> = { private: "Só eu", school: "Professores da escola" };
const KIND: Record<string, string> = { didatico: "Material didático", teoria: "Teoria de referência", planejamento: "Planejamento", prova_exportada: "Prova exportada", outro: "Outro" };

type Aba = "tudo" | "provas" | "apresentacoes" | "materiais";
const ABAS: { id: Aba; label: string }[] = [{ id: "tudo", label: "Tudo" }, { id: "provas", label: "Provas" }, { id: "apresentacoes", label: "Apresentações" }, { id: "materiais", label: "Materiais" }];
type Item = { key: string; tipo: "prova" | "apresentacao" | "material"; title: string; meta: string; at: Date; open?: { href: string; label: string; ext?: boolean }; menu?: React.ReactNode; snippet?: string | null };
const ICON = { prova: "P", apresentacao: "A", material: "M" } as const;

export default async function Biblioteca({ searchParams }: { searchParams: Promise<{ aba?: string; turma?: string; q?: string }> }) {
  const sp = await searchParams;
  const aba: Aba = ABAS.some((a) => a.id === sp.aba) ? (sp.aba as Aba) : "tudo";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const ctx = await requireCtx();
  const cls = await visibleClasses(ctx);
  const like = q ? `%${q.replace(/[%_\\]/g, "\\$&")}%` : null;
  const [rows, provas, apres] = await Promise.all([
    aba === "provas" || aba === "apresentacoes" ? [] : db.select({ m: materials, cname: classes.name }).from(materials).leftJoin(classes, eq(classes.id, materials.classId))
      .where(and(eq(materials.orgId, ctx.org.id), or(eq(materials.ownerId, ctx.user.id), and(eq(materials.visibility, "school"), eq(materials.approval, "approved"))), like ? ilike(materials.title, like) : undefined, sp.turma ? eq(materials.classId, sp.turma) : undefined)).orderBy(desc(materials.createdAt)),
    aba === "apresentacoes" || aba === "materiais" || sp.turma ? [] : db.select({ id: assessments.id, title: assessments.title, status: assessments.status, at: assessments.updatedAt }).from(assessments).where(and(eq(assessments.orgId, ctx.org.id), eq(assessments.ownerId, ctx.user.id), like ? ilike(assessments.title, like) : undefined)).orderBy(desc(assessments.updatedAt)).limit(60),
    aba === "provas" || aba === "materiais" || sp.turma ? [] : db.select({ id: assistantFiles.id, title: assistantFiles.title, at: assistantFiles.createdAt }).from(assistantFiles).where(and(eq(assistantFiles.orgId, ctx.org.id), eq(assistantFiles.ownerId, ctx.user.id), like ? ilike(assistantFiles.title, like) : undefined)).orderBy(desc(assistantFiles.createdAt)).limit(60),
  ]);
  const manager = ctx.org.role === "coordinator" || ctx.org.role === "admin";
  const pending = manager ? rows.filter((r) => r.m.approval === "pending") : [];
  const items: Item[] = [
    ...provas.map((p): Item => ({ key: `p${p.id}`, tipo: "prova", title: p.title, meta: `Prova · ${p.status === "applied" ? "aplicada" : "rascunho"}`, at: p.at, open: { href: `/app/provas/${p.id}`, label: "Abrir" } })),
    ...apres.map((a): Item => ({ key: `a${a.id}`, tipo: "apresentacao", title: a.title, meta: "Apresentação · PowerPoint", at: a.at, open: { href: `/api/assistente/arquivo/${a.id}`, label: "Baixar" } })),
    ...rows.map(({ m, cname }): Item => ({
      key: `m${m.id}`, tipo: "material", title: m.title, at: m.createdAt, snippet: m.description ?? (m.text ? m.text.slice(0, 140) : null),
      meta: [KIND[m.kind], cname, VIS[m.visibility], m.approval !== "approved" ? (m.approval === "pending" ? "aguardando aprovação" : "rejeitado") : null, m.ownerId !== ctx.user.id ? "da escola" : null].filter(Boolean).join(" · "),
      open: m.file ? { href: `/api/material/${m.id}`, label: "Baixar" } : m.url ? { href: m.url, label: "Abrir link", ext: true } : undefined,
      menu: (
        <>
          {m.text && m.ownerId === ctx.user.id && <form action={useAsTheoryAction.bind(null, m.id)}><button className="link-btn" type="submit">Usar como teoria (nova prova)</button></form>}
          {m.classId && <Link href={`/app/turmas/${m.classId}/avaliacoes`}>Registrar prova existente</Link>}
          {m.ownerId === ctx.user.id && <form action={deleteMaterialAction.bind(null, m.id)}><button className="link-btn text-danger" type="submit">Excluir</button></form>}
        </>),
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const href = (a: Aba) => `?${new URLSearchParams({ ...(a !== "tudo" ? { aba: a } : {}), ...(q ? { q } : {}), ...(sp.turma ? { turma: sp.turma } : {}) })}`;
  return (
    <div className="lib">
      <div className="lib-head"><div><h1>Biblioteca</h1><p>Seus materiais, provas e apresentações num só lugar.</p></div><NovoMaterial classes={cls.map((c) => ({ id: c.id, name: c.name }))} /></div>
      <div className="lib-bar">
        <nav className="lib-tabs" aria-label="Tipo">{ABAS.map((a) => <Link key={a.id} href={href(a.id)} aria-current={a.id === aba ? "page" : undefined} data-testid={`aba-${a.id}`}>{a.label}</Link>)}</nav>
        <form className="lib-search" role="search"><input type="hidden" name="aba" value={aba === "tudo" ? "" : aba} /><label className="sr-only" htmlFor="lib-q">Buscar na biblioteca</label><input id="lib-q" name="q" defaultValue={q} placeholder="Buscar…" />
          <label className="sr-only" htmlFor="lib-turma">Turma</label><select id="lib-turma" name="turma" defaultValue={sp.turma ?? ""}><option value="">Todas as turmas</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="submit" className="btn btn-ghost btn-sm">Filtrar</button></form>
      </div>
      {pending.length > 0 && <section className="card-amber mb-4"><h2 className="mb-2 text-lg">Aguardando aprovação ({pending.length})</h2><ul className="space-y-2 text-sm">{pending.map(({ m }) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2"><span>{m.title} <span className="hint">· {VIS[m.visibility]}</span></span><span className="flex gap-3"><form action={approveMaterialAction.bind(null, m.id, true)}><button className="link-btn" type="submit">Aprovar</button></form><form action={approveMaterialAction.bind(null, m.id, false)}><button className="link-btn text-danger" type="submit">Rejeitar</button></form></span></li>)}</ul></section>}
      {items.length === 0 ? <div className="lib-empty"><p>{q || sp.turma ? "Nada encontrado." : "Sua biblioteca está vazia."}</p><p className="hint">Crie uma <Link href="/app/provas/montar">prova</Link>, peça uma apresentação à <Link href="/app/assistente">GizIA</Link> ou adicione um material.</p></div> : (
        <ul className="lib-list">{items.map((it) => (
          <li key={it.key} className="lib-row">
            <span className={`lib-ico ${it.tipo}`} aria-hidden>{ICON[it.tipo]}</span>
            <div className="lib-main"><h3>{it.title}</h3><p>{it.meta} · {fmtDateTime(it.at)}</p>{it.snippet && <p className="lib-snip">{it.snippet}</p>}</div>
            <div className="lib-acts">
              {it.open && <a className="btn btn-ghost btn-sm" href={it.open.href} {...(it.open.ext ? { target: "_blank", rel: "noreferrer noopener" } : {})}>{it.open.label}</a>}
              {it.menu && <details className="lib-menu"><summary aria-label={`Mais ações: ${it.title}`}>⋯</summary><div>{it.menu}</div></details>}
            </div>
          </li>))}</ul>)}
    </div>
  );
}
