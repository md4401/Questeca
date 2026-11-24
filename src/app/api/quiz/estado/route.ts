import { NextResponse } from "next/server";
import { estadoDoJogador } from "@/lib/quiz";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = new URL(req.url);
  const s = await estadoDoJogador(u.searchParams.get("code") ?? "", u.searchParams.get("player") ?? "", u.searchParams.get("secret") ?? "");
  if (!s) return NextResponse.json({ error: "Jogo ou jogador não encontrado." }, { status: 404 });
  return NextResponse.json(s, { headers: { "cache-control": "no-store" } });
}
