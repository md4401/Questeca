import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { loadAssessment } from "@/lib/access";
import { snapshotFor, ownerName } from "@/lib/export-helpers";
import { renderExam } from "@/lib/pdf";
import { conflictsFor, getItems } from "@/lib/assessments";
import { planInfo } from "@/lib/billing";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata = { title: "Prévia e arquivos" };

export default async function Previa({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cinza?: string; fonte?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const items = await getItems(id);
  if (!items.length) return <div className="card"><p>A prova ainda não tem questões para visualizar.</p><Link className="btn mt-3" href={`/app/provas/${id}`}>Voltar ao editor</Link></div>;
  const { snap, label } = await snapshotFor(ctx, a, { draft: true });
  const [cls] = a.classId ? await db.select().from(classes).where(eq(classes.id, a.classId)).limit(1) : [];
  const { warnings } = await renderExam(snap, { mode: "student", teacher: await ownerName(a.ownerId), className: cls?.name, bigFont: sp.fonte === "grande", versionLabel: label });
  const conflicts = await conflictsFor(id, a.scope);
  const info = await planInfo(ctx.org.id);
  const q = (extra: Record<string, string>) => new URLSearchParams({ id, rascunho: "1", ...extra }).toString();
  const frame = `/api/export/prova?${q({ tipo: "aluno", inline: "1", ...(sp.fonte === "grande" ? { fonte: "grande" } : {}) })}`;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section aria-label="Prévia A4">
        <div className="mb-2 flex flex-wrap items-center gap-3 text-sm no-print">
          <Link className={`btn btn-sm ${sp.cinza ? "" : "btn-ghost"}`} href={`/app/provas/${id}/previa?${new URLSearchParams({ ...(sp.cinza ? {} : { cinza: "1" }), ...(sp.fonte ? { fonte: sp.fonte } : {}) })}`}>{sp.cinza ? "Escala de cinza: ligada" : "Ver em escala de cinza"}</Link>
          <Link className={`btn btn-sm ${sp.fonte ? "" : "btn-ghost"}`} href={`/app/provas/${id}/previa?${new URLSearchParams({ ...(sp.fonte ? {} : { fonte: "grande" }), ...(sp.cinza ? { cinza: "1" } : {}) })}`}>{sp.fonte ? "Fonte maior: ligada" : "Fonte maior"}</Link>
        </div>
        <iframe title="Prévia da prova do aluno em A4" src={frame} className="h-[78vh] w-full rounded-lg border border-line bg-white" style={sp.cinza ? { filter: "grayscale(1)" } : undefined} />
      </section>
      <aside className="space-y-4">
        <section className="card"><h2 className="mb-2 text-lg">Arquivos</h2>
          {conflicts.length > 0 && <p className="card-danger mb-3 text-sm">Há itens fora do escopo. Resolva no editor antes de aplicar.</p>}
          <ul className="space-y-2 text-sm">
            <li><a className="btn w-full" href={`/api/export/prova?${q({ tipo: "aluno", ...(sp.fonte ? { fonte: "grande" } : {}) })}`}>Baixar PDF do aluno</a></li>
            <li><a className="btn btn-ghost w-full" href={`/api/export/prova?${q({ tipo: "professor" })}`}>Baixar PDF do professor (gabarito)</a></li>
            <li><a className={`btn btn-ghost w-full ${info.features.word ? "" : "opacity-60"}`} href={info.features.word ? `/api/export/prova?${q({ tipo: "aluno", formato: "docx" })}` : "/app/plano"}>Word editável do aluno {info.features.word ? "" : "(plano Professor)"}</a></li>
            <li><a className={`btn btn-ghost w-full ${info.features.word ? "" : "opacity-60"}`} href={info.features.word ? `/api/export/prova?${q({ tipo: "professor", formato: "docx" })}` : "/app/plano"}>Word do professor {info.features.word ? "" : "(plano Professor)"}</a></li>
          </ul>
          <p className="hint mt-3">O PDF do aluno nunca contém gabarito, comentários de seleção ou rubricas. O gabarito vai em arquivo separado. Edições no Word exigem conferência do gabarito antes de importar resultados.</p>
        </section>
        <section className="card"><h2 className="mb-2 text-lg">Alertas de formatação</h2>
          {warnings.length === 0 ? <p className="text-sm text-ink-soft">Nenhum alerta. Questões inteiras cabem nas páginas e o cabeçalho está completo.</p> : <ul className="space-y-1 text-sm">{warnings.map((w) => <li key={w} className="text-amber">⚠ {w}</li>)}</ul>}
          {!ctx.org.settings.header?.schoolName && <p className="mt-2 text-sm">Configure o cabeçalho em <Link href="/app/escola">Escola › Modelos</Link>.</p>}
        </section>
        <Link className="btn btn-ghost w-full" href={`/app/provas/${id}/aplicacao`}>Seguir para a aplicação</Link>
      </aside>
    </div>
  );
}
