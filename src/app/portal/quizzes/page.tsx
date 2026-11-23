import Link from "next/link";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { quizzes, quizAttempts } from "@/db/schema";
import { requirePortal, anyOf } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Quizzes" };
export default async function PortalQuizzes({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const sp = await searchParams; const p = await requirePortal(sp.aluno);
  const list = await db.select().from(quizzes).where(and(inArray(quizzes.classId, anyOf(p.classIds)), ne(quizzes.status, "draft"))).orderBy(desc(quizzes.createdAt));
  const att = list.length ? await db.select().from(quizAttempts).where(and(inArray(quizAttempts.quizId, list.map((q) => q.id)), eq(quizAttempts.studentId, p.student.id))) : [];
  const q = p.students.length > 1 ? `?aluno=${p.student.id}` : "";
  return (
    <div className="space-y-4"><StudentSwitch list={p.students} active={p.student.id} base="/portal/quizzes" /><h1>Quizzes</h1>
      {list.length === 0 ? <p className="card text-ink-soft">Nenhum quiz publicado.</p> : <ul className="space-y-3">{list.map((x) => {
        const mine = att.filter((a) => a.quizId === x.id); const best = mine.filter((a) => a.status === "submitted").reduce((b, a) => Math.max(b, Number(a.score ?? 0)), -1);
        return <li key={x.id} className="card"><Link href={`/portal/quizzes/${x.id}${q}`} className="font-semibold">{x.title}</Link><p className="hint">{x.items.length} questão(ões){x.timeLimitMin ? ` · ${x.timeLimitMin} min` : ""} · {x.dueAt ? `até ${fmtDateTime(x.dueAt)}` : "sem prazo"} · {mine.length}/{x.maxAttempts} tentativa(s){best >= 0 ? ` · melhor nota ${String(best).replace(".", ",")}` : ""}{x.status === "closed" ? " · encerrado" : ""}</p></li>;
      })}</ul>}
    </div>
  );
}
