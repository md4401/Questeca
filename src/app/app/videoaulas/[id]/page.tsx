import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { videoLessons } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { VideoPlayer } from "@/components/video-player";
import { registerViewAction } from "../actions";

export const metadata = { title: "Videoaula" };
export default async function Video({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireCtx();
  const [v] = await db.select().from(videoLessons).where(and(eq(videoLessons.id, id), eq(videoLessons.orgId, ctx.org.id))).limit(1);
  if (!v || (!v.published && v.authorId !== ctx.user.id)) notFound();
  await registerViewAction(id);
  return <div className="max-w-3xl space-y-3"><p className="hint"><Link href="/app/videoaulas">Videoaulas</Link> › {v.title}</p><h1>{v.title}</h1><VideoPlayer url={v.url} title={v.title} />{v.description && <p className="whitespace-pre-line">{v.description}</p>}</div>;
}
