import { Form, Field, SubmitButton } from "@/components/form";
import { forgotAction } from "@/lib/auth-actions";
import { emailEnabled } from "@/lib/email";

export const metadata = { title: "Recuperar acesso" };

export default function Recuperar() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1>Recuperar acesso</h1>
      <p className="mt-1 text-ink-soft">Informe o e-mail da conta. Enviaremos um link válido por 1 hora.</p>
      {!emailEnabled() && <p className="card-amber mt-4 text-sm">O envio de e-mails ainda não foi configurado neste ambiente. Entre em contato com o suporte para redefinir sua senha.</p>}
      <Form action={forgotAction} className="card mt-6">
        <Field label="E-mail" name="email" type="email" required autoComplete="email" />
        <SubmitButton>Enviar instruções</SubmitButton>
      </Form>
    </div>
  );
}
