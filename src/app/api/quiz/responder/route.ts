import { NextResponse } from "next/server";
import { responder } from "@/lib/quiz";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { code?: string; player?: string; secret?: string; choice?: number };
  const r = await responder(String(b.code ?? ""), String(b.player ?? ""), String(b.secret ?? ""), Number(b.choice));
  return NextResponse.json(r.ok ? r : { error: r.error }, { status: r.ok ? 200 : 400 });
}
