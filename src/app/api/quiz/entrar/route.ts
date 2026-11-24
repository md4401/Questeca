import { NextResponse } from "next/server";
import { entrar } from "@/lib/quiz";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { code?: string; nickname?: string };
  const ip = (req.headers.get("x-forwarded-for") ?? "?").split(",")[0].trim();
  if (!(await rateLimit(`quiz-join:${ip}`, 40, 60))) return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto." }, { status: 429 });
  const r = await entrar(String(b.code ?? ""), String(b.nickname ?? ""));
  return NextResponse.json(r.ok ? r : { error: r.error }, { status: r.ok ? 200 : 400 });
}
