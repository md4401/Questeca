import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orgs } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { rulesFrom, studentGrades, cellLabel } from "@/lib/gradebook";
import { situation } from "@/lib/core/grades";
import { PageHead } from "@/components/page-head";
import { SIT_LABEL, SIT_TONE, tone } from "../../page";

export const metadata = { title: "Notas do aluno" };
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export default async function NotasAluno({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: Promise<{ turma?: string; periodo?: string }> }) {
  const { studentId } = await params; const sp = await searchParams;
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, sp.turma ?? "");
  const stud = (await classStudents(cls.id)).find((s) => s.id === studentId);
  if (!stud) notFound();
  const [org] = await db.select({ settings: orgs.settings }).from(orgs).where(eq(orgs.id, cls.orgId)).limit(1);
  const rules = rulesFrom(org?.settings ?? {});
  const blocks = await Promise.all(rules.periods.map(async (p) => ({ p, g: await studentGrades(cls.id, stud.id, p, rules) })));
  return (
    <div className="space-y-6">
      <p className="hint"><Link href={`/app/notas?turma=${cls.id}${sp.periodo ? `&periodo=${encodeURIComponent(sp.periodo)}` : ""}`}>Notas</Link> › {cls.name}</p>
      <PageHead icon="nota" title={stud.name} sub={`${cls.name}${stud.registration ? ` · RA ${stud.registration}` : ""}`} />
      {blocks.map(({ p, g }) => { const avg = g.computed.average; const sit = situation(avg, rules.passMark); return (
        <section key={p} className="card" aria-label={`Notas de ${stud.name} em ${p}`}>
          <div className="section-title"><h2>{p}</h2><span className="flex items-center gap-2"><strong>{avg == null ? "—" : `Média ${fmt(avg)}`}</strong><span className="chip-status" data-s={SIT_TONE[sit]}>{SIT_LABEL[sit]}</span></span></div>
          {g.items.length === 0 ? <p className="empty !py-4">Nenhuma atividade neste período.</p> : (
            <table className="t"><thead><tr><th scope="col">Atividade</th><th scope="col">Peso</th><th scope="col" className="text-center">Nota</th></tr></thead><tbody>
              {g.items.map((i, k) => { const c = g.cells[k]; const num = c.value != null && (c.state === "value" || c.state === "zero") ? c.value : null; return (
                <tr key={i.id}><td>{i.title}{i.recovery ? <span className="badge badge-gray ml-2">recuperação</span> : null}</td><td>{String(Number(i.weight)).replace(".", ",")}</td><td className="text-center"><span className={num == null ? "hint" : `grade-${tone(num, Number(i.maxPoints) || 10, rules.passMark, rules.scaleMax)}`}>{cellLabel(c) || "—"}</span></td></tr>); })}
            </tbody></table>)}
          {g.computed.formula && <p className="hint mt-2">{g.computed.formula}</p>}
        </section>); })}
    </div>
  );
}
