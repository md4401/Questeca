import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { TabLinks } from "@/components/nav";
import { gradeLabel, subjectLabel } from "@/lib/taxonomy";
import Link from "next/link";

export default async function ClassLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, id);
  return (
    <div>
      <p className="hint"><Link href="/app/turmas">Turmas</Link> › {ctx.org.name}</p>
      <h1 className="mb-1">{cls.name} {cls.isDemo && <span className="badge badge-amber align-middle">Exemplo</span>}</h1>
      <p className="hint mb-4">{gradeLabel(cls.grade)} · {subjectLabel(cls.subject)} · {cls.year}</p>
      <TabLinks base={`/app/turmas/${id}`} tabs={[{ slug: "", label: "Visão geral" }, { slug: "alunos", label: "Alunos" }, { slug: "avaliacoes", label: "Avaliações" }, { slug: "notas", label: "Notas" }, { slug: "frequencia", label: "Frequência" }, { slug: "boletins", label: "Boletins" }, { slug: "analitico", label: "Painel" }, { slug: "observacoes", label: "Observações" }, { slug: "pareceres", label: "Pareceres" }, { slug: "relatorios", label: "Relatórios" }]} />
      {children}
    </div>
  );
}
