import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { Sorteio } from "@/components/sorteio";

export const metadata = { title: "Sorteio e grupos" };
export default async function SorteioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const ctx = await requireCtx(); await loadClass(ctx, id);
  const alunos = (await classStudents(id)).map((s) => ({ id: s.id, name: s.name }));
  return alunos.length ? <Sorteio alunos={alunos} /> : <section className="card text-ink-soft">Esta turma ainda não tem alunos cadastrados.</section>;
}
