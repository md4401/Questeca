import { NextResponse } from "next/server";
import { verifyStripeSignature, handleStripeEvent } from "@/lib/billing-provider";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("Webhook não configurado", { status: 503 });
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  if (!verifyStripeSignature(payload, sig, secret)) return new NextResponse("Assinatura inválida", { status: 400 });
  try {
    const r = await handleStripeEvent(JSON.parse(payload));
    return NextResponse.json(r);
  } catch (e) {
    console.error("webhook falhou", e);
    return new NextResponse("Erro", { status: 500 }); // o provedor reenvia; o processamento é idempotente
  }
}
