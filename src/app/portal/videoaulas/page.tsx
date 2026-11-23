import Link from "next/link";
import { and, desc, eq, or, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { videoLessons } from "@/db/schema";
import { requirePortal, anyOf } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";

export const metadata = { title: "Videoaulas" };
export default async function PortalVideos({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const sp = await searchParams; const p = await requirePortal(sp.aluno);
  const rows = await db.select().from(videoLessons).where(and(eq(videoLessons.orgId, p.ctx.org.id), eq(videoLessons.published, true), or(isNull(videoLessons.classId), inArray(videoLessons.classId, anyOf(p.classIds))))).orderBy(desc(videoLessons.createdAt));
  return (
    <div className="space-y-4"><StudentSwitch list={p.students} active={p.student.id} base="/portal/videoaulas" /><h1>Videoaulas</h1>
      {rows.length === 0 ? <p className="card text-ink-soft">Nenhuma videoaula publicada.</p> : <ul className="grid gap-3 sm:grid-cols-2">{rows.map((v) => (
        <li key={v.id} className="card">{v.thumbnailUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.thumbnailUrl} alt="" className="mb-2 aspect-video w-full rounded-lg object-cover" loading="lazy" referrerPolicy="no-referrer" />}
          <h2 className="text-lg"><Link href={`/portal/videoaulas/${v.id}`}>{v.title}</Link></h2><p className="hint">{v.subject ?? ""}{v.durationMin ? ` · ${v.durationMin} min` : ""}</p></li>))}</ul>}
    </div>
  );
}
