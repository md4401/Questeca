import Link from "next/link";
import { Form, Field, SubmitButton } from "@/components/form";
import { resetAction } from "@/lib/auth-actions";

export const metadata = { title: "Nova senha" };

export default async function Redefinir({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <div className="mx-auto max-w-md px-4 py-12"><p className="err">Link inválido.</p><Link href="/recuperar">Pedir novo link</Link></div>;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1>Criar nova senha</h1>
      <Form action={resetAction} className="card mt-6">
        <input type="hidden" name="token" value={token} />
        <Field label="Nova senha" name="password" type="password" required autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." />
        <SubmitButton>Salvar nova senha</SubmitButton>
      </Form>
    </div>
  );
}
