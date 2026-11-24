import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, orgs, schools } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { parseDraft, EMPTY_DRAFT, type Draft } from "@/lib/core/onboarding";
import { Wizard } from "./wizard";

export const metadata = { title: "Primeiros passos" };
export const dynamic = "force-dynamic";

export default async function PrimeirosPassos({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const mine = await visibleClasses(ctx);
  const editing = sp.editar === "1";
  if (!editing && ctx.user.onboardingDoneAt && mine.length) redirect("/app");

  // Turmas já cadastradas na escola ativa, por série, para oferecer como opção.
  const all = await db.select({ grade: classes.grade, name: classes.name }).from(classes).where(and(eq(classes.orgId, ctx.org.id), eq(classes.archived, false)));
  const knownClasses: Record<string, string[]> = {};
  for (const c of all) { const l = (knownClasses[c.grade] ??= []); if (!l.includes(c.name)) l.push(c.name); }

  let draft: Draft = ctx.user.onboardingDraft ? parseDraft(ctx.user.onboardingDraft) : { ...EMPTY_DRAFT };
  // Quem já usava a Segunda Lousa: aproveita o que existe na conta.
  if (!ctx.user.onboardingDraft && mine.length) {
    const assignments: Draft["assignments"] = {};
    for (const c of mine) ((assignments[c.subject] ??= {})[c.grade] ??= []).push(c.name);
    draft = { ...draft, subjects: Object.keys(assignments), assignments };
  }
  if (editing && draft.step === 4) draft = { ...draft, step: 1 };

  const [org] = await db.select().from(orgs).where(eq(orgs.id, ctx.org.id)).limit(1);
  const linkedName = ctx.org.kind === "school" ? ctx.org.name : null;
  if (linkedName) draft = { ...draft, school: { kind: "linked", orgId: ctx.org.id, name: linkedName } };
  else if (!draft.school && org?.schoolId) {
    const [s] = await db.select().from(schools).where(eq(schools.id, org.schoolId)).limit(1);
    if (s) draft = { ...draft, school: { kind: "catalog", id: s.id, name: s.name, city: s.city, uf: s.uf, neighborhood: s.neighborhood } };
  } else if (!draft.school && org?.schoolManual && org.city && org.uf) draft = { ...draft, school: { kind: "manual", name: org.name, city: org.city, uf: org.uf } };

  return <Wizard initial={draft} linkedName={linkedName} knownClasses={knownClasses} editing={editing} />;
}
