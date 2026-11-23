import { requirePortal } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";
import { MuralFeed } from "@/components/mural";

export const metadata = { title: "Mural" };

export default async function PortalMural({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const sp = await searchParams;
  const p = await requirePortal(sp.aluno);
  return (
    <div className="space-y-4">
      <StudentSwitch list={p.students} active={p.student.id} base="/portal/mural" />
      <h1>Mural das turmas</h1>
      <MuralFeed classIds={p.classIds} orgId={p.ctx.org.id} viewer={p.ctx.org.role === "student" ? "student" : "guardian"} userId={p.ctx.user.id} />
    </div>
  );
}
