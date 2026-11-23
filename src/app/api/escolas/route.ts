import { NextResponse } from "next/server";
import { getCtx } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { searchSchools, catalogSize, FULL_CATALOG_MIN } from "@/lib/schools";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!(await rateLimit(`schools:${ctx.user.id}`, 120, 60))) return NextResponse.json({ error: "rate" }, { status: 429 });
  const u = new URL(req.url);
  try {
    const results = await searchSchools({ q: u.searchParams.get("q") ?? "", uf: u.searchParams.get("uf") ?? undefined, city: u.searchParams.get("cidade") ?? undefined, limit: 8 });
    const n = await catalogSize();
    return NextResponse.json({ results, coverage: n === 0 ? "empty" : n < FULL_CATALOG_MIN ? "partial" : "full" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
