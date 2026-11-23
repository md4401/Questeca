import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { lessonPlans } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { myClassesAllOrgs } from "@/lib/my-classes";
import { Form, SubmitButton } from "@/components/form";
import { createPlanAction } from "./actions";
import { fmtDate, todayISO } from "@/lib/format";
import { aiAvailable } from "@/lib/ai";

export const metadata = { title: "Planos de aula" };

export default async function Planos({ searchParams }: { searchParams: Promise<{ turma?: string; data?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const cls = await myClassesAllOrgs(ctx);
  const plans = await db.select().from(lessonPlans).where(eq(lessonPlans.authorId, ctx.user.id)).orderBy(desc(lessonPlans.updatedAt)).limit(30);
  return (
    <div>
    <PageHead icon="material" title="Planos de aula" sub="Digite o tema e receba o plano pronto no formato escolar." />
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="card">
        <h2 className="mb-1">Gerar plano de aula</h2>
        <p className="hint mb-3">Digite o tema e receba o plano no formato escolar: objetivos, habilidades, momentos com tempo, avaliação e adaptações. {aiAvailable() ? "Gerado com apoio de IA." : "Gerado por modelo; você edita depois."}</p>
        <Form action={createPlanAction}>
          <div className="field"><label htmlFor="theme">Tema da aula</label><input id="theme" name="theme" className="input" placeholder="Ex.: Porcentagem e descontos sucessivos" required /></div>
          <div className="field"><label htmlFor="classId">Turma</label>
            <select id="classId" name="classId" className="input" defaultValue={sp.turma ?? ""}><option value="">Sem turma</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}{ctx.orgs.length > 1 ? ` — ${c.orgName}` : ""}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label htmlFor="durationMin">Duração (min)</label><input id="durationMin" name="durationMin" type="number" min={20} max={240} defaultValue={50} className="input" /></div>
            <div className="field"><label htmlFor="plannedFor">Data da aula</label><input id="plannedFor" name="plannedFor" type="date" defaultValue={sp.data ?? todayISO()} className="input" /></div>
          </div>
          <SubmitButton pendingLabel="Gerando plano…">Gerar plano de aula</SubmitButton>
        </Form>
      </section>
      <section className="card"><h2 className="mb-2 text-lg">Meus planos</h2>
        {plans.length === 0 ? <p className="text-ink-soft">Nenhum plano ainda.</p> : <ul className="divide-y divide-line">{plans.map((p) => <li key={p.id} className="py-2"><Link href={`/app/planos-de-aula/${p.id}`}><strong>{p.theme}</strong></Link><span className="hint"> · {p.plannedFor ? fmtDate(p.plannedFor) : "sem data"}{p.sentAt ? " · enviado à coordenação" : ""}</span></li>)}</ul>}
      </section>
    </div>
    </div>
  );
}
