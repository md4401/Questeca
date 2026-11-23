import Link from "next/link";
import { verifyEmailToken } from "@/lib/auth-core";

export const metadata = { title: "Confirmar e-mail" };

export default async function Verificar({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const ok = token ? await verifyEmailToken(token) : false;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1>{ok ? "E-mail confirmado" : "Link inválido ou expirado"}</h1>
      <p className="mt-2 text-ink-soft">{ok ? "Tudo certo com a sua conta." : "Entre na sua conta e peça um novo link de confirmação."}</p>
      <p className="mt-4"><Link className="btn" href="/app">Ir para o início</Link></p>
    </div>
  );
}
