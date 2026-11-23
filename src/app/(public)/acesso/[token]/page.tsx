import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orgs, students } from "@/db/schema";
import { getCtx } from "@/lib/session";
import { Form, Field, SubmitButton } from "@/components/form";
import { loadAccessInvite, redeemAccessAction } from "./actions";

export const metadata = { title: "Acesso ao portal", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Acesso({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await loadAccessInvite(token);
  if (!inv) return (
    <div className="mx-auto max-w-md px-4 py-16"><h1>Link indisponível</h1><p className="mt-2 text-ink-soft">Este link expirou, já foi usado ou foi revogado. Peça um novo à escola.</p><Link className="btn mt-6" href="/entrar">Entrar</Link></div>);
  const [org] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, inv.orgId)).limit(1);
  const [st] = await db.select({ name: students.name }).from(students).where(eq(students.id, inv.studentId)).limit(1);
  const ctx = await getCtx();
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1>Acesso ao portal</h1>
      <p className="mt-1 text-ink-soft">{org?.name} convidou você como <strong>{inv.kind === "student" ? "aluno(a)" : "responsável"}</strong> de <strong>{st?.name}</strong>.</p>
      <Form action={redeemAccessAction.bind(null, token)} className="card mt-6">
        {ctx ? <p className="mb-3 text-sm">Você está conectado(a) como <strong>{ctx.user.email}</strong>. O vínculo será feito nesta conta.</p> : (<>
          <Field label="Seu nome" name="name" required autoComplete="name" />
          <Field label="E-mail" name="email" type="email" required autoComplete="email" />
          <Field label="Senha" name="password" type="password" required autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." />
          <div className="field"><label className="flex items-start gap-2 font-normal"><input type="checkbox" name="accept" className="mt-1" required /><span>Li e aceito os <Link href="/termos" target="_blank">termos de uso</Link> e a <Link href="/privacidade" target="_blank">política de privacidade</Link>.</span></label></div></>)}
        <SubmitButton className="btn w-full sm:w-auto" pendingLabel="Entrando…">{ctx ? "Vincular e entrar" : "Criar acesso"}</SubmitButton>
      </Form>
      {!ctx && <p className="mt-4 text-sm">Já tem conta? <Link href={`/entrar?next=/acesso/${token}`}>Entrar</Link> e abra este link de novo.</p>}
    </div>
  );
}
