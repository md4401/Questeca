import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications, assessmentVersions, responses, studentPresence } from "@/db/schema";
import { classStudents } from "@/lib/access";
import { scoreResponse } from "@/lib/core/answerkey";
import type { Snapshot } from "@/lib/assessments";

export type KeyItem = { position: number; key: string; points: number; label: string; rubric?: { name: string; points: number }[]; topics: string[]; title: string };

export async function applicationKey(app: typeof applications.$inferSelect): Promise<{ items: KeyItem[]; versionNumber: number | null; total: number }> {
  if (app.kind === "external" && app.external) {
    const e = app.external;
    const items = e.answerKey.map((k, i) => ({ position: i + 1, key: k, points: e.points[i], label: `Questão ${i + 1}`, rubric: e.rubrics?.[i], topics: [], title: `Questão ${i + 1}` }));
    return { items, versionNumber: null, total: e.points.reduce((a, b) => a + b, 0) };
  }
  const [v] = app.versionId ? await db.select().from(assessmentVersions).where(eq(assessmentVersions.id, app.versionId)).limit(1) : [];
  const snap = (v?.snapshot ?? { items: [] }) as Snapshot;
  const items = snap.items.map((it) => ({ position: it.position, key: it.alternatives.length ? it.answer ?? "" : "*", points: Number(it.points), label: `Questão ${it.position}`, topics: it.assessed, title: it.title }));
  return { items, versionNumber: v?.number ?? null, total: items.reduce((a, b) => a + b.points, 0) };
}

export async function applicationData(app: typeof applications.$inferSelect) {
  const [studs, key, resp, presence] = await Promise.all([
    classStudents(app.classId), applicationKey(app),
    db.select().from(responses).where(eq(responses.applicationId, app.id)),
    db.select().from(studentPresence).where(eq(studentPresence.applicationId, app.id)),
  ]);
  const rmap = new Map(resp.map((r) => [`${r.studentId}:${r.position}`, r]));
  const absent = new Set(presence.filter((p) => p.state === "absent").map((p) => p.studentId));
  const rows = studs.map((s) => {
    const cells = key.items.map((it) => {
      const r = rmap.get(`${s.id}:${it.position}`);
      return { position: it.position, value: r?.value ?? "", status: r?.status ?? "pending", points: r?.points != null ? Number(r.points) : null };
    });
    const complete = cells.every((c) => c.status !== "pending");
    const total = cells.reduce((a, c) => a + (c.points ?? 0), 0);
    return { student: s, cells, absent: absent.has(s.id), complete, total: Math.round(total * 100) / 100 };
  });
  return { students: studs, key, rows };
}

export function scoreCell(item: KeyItem, value: string) {
  return scoreResponse({ key: item.key, points: item.points, value, status: "answered" });
}

export { and, eq };
