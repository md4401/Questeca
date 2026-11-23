import Link from "next/link";
import { redirect } from "next/navigation";
import { Form, Field, SubmitButton } from "@/components/form";
import { signupAction } from "@/lib/auth-actions";
import { getCtx } from "@/lib/session";
import { loadInvite } from "@/lib/auth-core";

export const metadata = { title: "Criar conta" };

export default async function CriarConta({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const sp = await searchParams;
  if (await getCtx()) redirect(sp.invite ? `/convite/${sp.invite}` : "/app");
  const invite = sp.invite ? await loadInvite(sp.invite) : null;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1>Criar conta</h1>
      <p className="mt-1 text-ink-soft">Leva menos de um minuto. Depois você escolhe seu colégio, suas disciplinas e turmas.</p>
      {invite?.status === "pending" && <p className="card-tint mt-4 text-sm">Convite para <strong>{invite.org?.name}</strong>. Use o e-mail <strong>{invite.inv.email}</strong> para aceitar.</p>}
      <Form action={signupAction} className="card mt-6">
        <input type="hidden" name="invite" value={sp.invite ?? ""} />
        <Field label="Nome" name="name" required autoComplete="name" />
        <Field label="E-mail" name="email" type="email" required autoComplete="email" defaultValue={invite?.status === "pending" ? invite.inv.email : undefined} />
        <Field label="Senha" name="password" type="password" required autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." />
        <div className="field">
          <label className="flex items-start gap-2 font-normal">
            <input type="checkbox" name="accept" className="mt-1" required />
            <span>Li e aceito os <Link href="/termos" target="_blank">termos de uso</Link> e a <Link href="/privacidade" target="_blank">política de privacidade</Link>.</span>
          </label>
        </div>
        <SubmitButton className="btn w-full sm:w-auto" pendingLabel="Criando conta…">Criar conta</SubmitButton>
      </Form>
      <p className="mt-4 text-sm">Já tem conta? <Link href="/entrar">Entrar</Link></p>
    </div>
  );
}
