import Link from "next/link";
import { redirect } from "next/navigation";
import { Form, Field, SubmitButton } from "@/components/form";
import { loginAction } from "@/lib/auth-actions";
import { getSession } from "@/lib/session";

export const metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  if (await getSession()) redirect("/app");
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1>Entrar</h1>
      {sp.reset && <p className="card-tint mt-4 text-sm">Senha alterada. Entre com a nova senha.</p>}
      <Form action={loginAction} className="card mt-6">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <Field label="E-mail" name="email" type="email" required autoComplete="email" />
        <Field label="Senha" name="password" type="password" required autoComplete="current-password" />
        <SubmitButton className="btn w-full sm:w-auto" pendingLabel="Entrando…">Entrar</SubmitButton>
      </Form>
      <p className="mt-4 text-sm"><Link href="/recuperar">Esqueci minha senha</Link> · <Link href="/criar-conta">Criar conta</Link></p>
    </div>
  );
}
