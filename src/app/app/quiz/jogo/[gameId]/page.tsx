import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { liveGames } from "@/db/schema";
import { HostPanel } from "./host-panel";

export const metadata = { title: "Quiz ao vivo" };
export default async function Jogo({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params; const ctx = await requireCtx();
  if (!/^[0-9a-f-]{36}$/i.test(gameId)) notFound();
  const [g] = await db.select({ id: liveGames.id, code: liveGames.code }).from(liveGames).where(and(eq(liveGames.id, gameId), eq(liveGames.hostId, ctx.user.id))).limit(1);
  if (!g) notFound();
  return <HostPanel gameId={g.id} code={g.code} />;
}
