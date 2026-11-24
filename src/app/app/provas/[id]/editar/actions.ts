"use server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assessments, assessmentItems, questions } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadAssessment } from "@/lib/access";
import { normalizeMarkup } from "@/lib/core/richtext";
import { audit } from "@/lib/audit";

export type EditPayload = {
  title: string;
  instructions: string | null;
  items: { itemId: string; statement: string | null; alternatives: { key: string; text: string }[] | null }[];
  blocks: { id: string; beforeItemId: string | null; text: string }[];
};
const esc = (t: string) => t.replace(/\{/g, "{lb}");
const MAX = 6000;

/** Salva as edições de texto da prova. O banco de questões não muda: as edições valem só para esta prova e viram nova versão ao gerar os arquivos. */
export async function saveExamEditsAction(assessmentId: string, p: EditPayload): Promise<{ ok: true; at: string; changed: number } | { ok: false; error: string }> {
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, assessmentId);
  if (a.ownerId !== ctx.user.id && ctx.org.role !== "coordinator") return { ok: false, error: "Só quem criou a prova (ou a coordenação) pode editar o texto." };
  const rows = await db.select({ item: assessmentItems, q: questions }).from(assessmentItems).innerJoin(questions, eq(questions.id, assessmentItems.questionId)).where(eq(assessmentItems.assessmentId, assessmentId));
  const byId = new Map(rows.map((r) => [r.item.id, r]));
  if (!Array.isArray(p.items) || !Array.isArray(p.blocks)) return { ok: false, error: "Dados inválidos." };
  if (p.blocks.length > 30) return { ok: false, error: "No máximo 30 blocos de texto." };

  let changed = 0;
  for (const it of p.items) {
    const r = byId.get(it.itemId);
    if (!r) return { ok: false, error: "Questão não pertence a esta prova." };
    let statement: string | undefined; let alternatives: { key: string; text: string }[] | undefined;
    if (it.statement != null) {
      const mk = normalizeMarkup(String(it.statement).slice(0, MAX));
      if (!mk.trim()) return { ok: false, error: "O enunciado de uma questão não pode ficar vazio." };
      if (mk !== normalizeMarkup(esc(r.q.statement ?? ""))) statement = mk;
    }
    if (it.alternatives) {
      const orig = r.q.alternatives;
      if (it.alternatives.length !== orig.length || it.alternatives.some((x, i) => x.key !== orig[i].key)) return { ok: false, error: "As letras das alternativas não podem mudar." };
      const mk = it.alternatives.map((x) => ({ key: x.key, text: normalizeMarkup(String(x.text).slice(0, 2000)) }));
      if (mk.some((x) => !x.text.trim())) return { ok: false, error: "Uma alternativa ficou vazia." };
      if (mk.some((x, i) => x.text !== normalizeMarkup(esc(orig[i].text)))) alternatives = mk;
    }
    const override = statement || alternatives ? { ...(statement ? { statement } : {}), ...(alternatives ? { alternatives: alternatives } : {}) } : null;
    // alternativas editadas guardam todas as letras (as não editadas entram com o texto original)
    if (override && alternatives == null && false) { /* mantido por clareza */ }
    const before = JSON.stringify(r.item.override ?? null);
    if (before !== JSON.stringify(override)) { changed++; await db.update(assessmentItems).set({ override }).where(and(eq(assessmentItems.id, it.itemId), eq(assessmentItems.assessmentId, assessmentId))); }
  }
  const blocks = p.blocks.map((b) => ({ id: String(b.id).slice(0, 40), beforeItemId: b.beforeItemId && byId.has(b.beforeItemId) ? b.beforeItemId : null, text: normalizeMarkup(String(b.text).slice(0, MAX)) })).filter((b) => b.text.trim());
  const instructions = p.instructions == null ? null : normalizeMarkup(String(p.instructions).slice(0, 3000));
  const title = String(p.title ?? "").trim().slice(0, 200) || a.title;
  const layout = blocks.length || instructions != null ? { instructions: instructions ?? undefined, blocks } : null;
  const layoutChanged = JSON.stringify(a.layout ?? null) !== JSON.stringify(layout) || title !== a.title;
  if (layoutChanged) changed++;
  if (changed > 0) {
    await db.update(assessments).set({ title, layout, revision: a.revision + 1, updatedAt: new Date() }).where(eq(assessments.id, assessmentId));
    await audit(ctx.user.id, a.orgId, "assessment.text_edited", assessmentId, { changed });
  }
  revalidatePath(`/app/provas/${assessmentId}`);
  return { ok: true, at: new Date().toISOString(), changed };
}
