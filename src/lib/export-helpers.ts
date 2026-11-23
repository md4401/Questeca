import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, orgs, applications, assessmentVersions } from "@/db/schema";
import { buildSnapshot, ensureVersion, latestVersion, getItems, type Snapshot } from "@/lib/assessments";
import type { Ctx } from "@/lib/session";

/** Snapshot de uma versão específica (por aplicação/versão) ou do rascunho atual com cabeçalho da escola. */
export async function snapshotFor(ctx: Ctx, a: Parameters<typeof buildSnapshot>[0], opts: { versionId?: string; draft?: boolean }) {
  const [orgRow] = await db.select({ settings: orgs.settings }).from(orgs).where(eq(orgs.id, a.orgId)).limit(1);
  const settings = orgRow?.settings ?? {};
  if (opts.versionId) {
    const [v] = await db.select().from(assessmentVersions).where(eq(assessmentVersions.id, opts.versionId)).limit(1);
    if (v && v.assessmentId === a.id) return { snap: v.snapshot as Snapshot, label: `Versão ${v.number}`, number: v.number };
  }
  if (opts.draft) {
    const snap = await buildSnapshot(a, settings);
    const last = await latestVersion(a.id);
    return { snap, label: `Rascunho (rev. ${a.revision})`, number: last?.number ?? 0 };
  }
  const v = await ensureVersion(a, settings);
  return { snap: v.snapshot as Snapshot, label: `Versão ${v.number}`, number: v.number };
}

export async function ownerName(userId: string) {
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.name ?? "";
}

export const pdfResponse = (bytes: Uint8Array, name: string, inline = false) =>
  new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`, "Cache-Control": "private, no-store" } });

export const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 50) || "prova";
export { getItems, applications };
