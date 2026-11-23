import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { loadAssessment } from "@/lib/access";
import { TabLinks } from "@/components/nav";

export default async function AssessmentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  return (
    <div>
      <p className="hint"><Link href="/app/provas">Provas</Link> › {a.title}</p>
      <TabLinks base={`/app/provas/${id}`} tabs={[{ slug: "", label: "Prova" }, { slug: "escopo", label: "Conteúdo" }, { slug: "previa", label: "Prévia e arquivos" }, { slug: "aplicacao", label: "Aplicação" }, { slug: "correcao", label: "Correção" }, { slug: "resultados", label: "Resultados" }]} />
      {children}
    </div>
  );
}
