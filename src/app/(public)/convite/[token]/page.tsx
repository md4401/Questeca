import Link from "next/link";
import { loadInvite } from "@/lib/auth-core";
import { acceptInviteAction } from "@/lib/auth-actions";
import { getCtx } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/core/permissions";
import { Form, SubmitButton } from "@/components/form";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { inArray } from "drizzle-orm";

export const metadata = { title: "Convite" };

const STATUS: Record<string, string> = { accepted: "Este convite já foi aceito.", revoked: "Este convite foi revogado pela escola. Peça um novo ao administrador.", expired: "Este convite expirou. Peça o reenvio ao administrador da escola." };

export default async function Convite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const loaded = await loadInvite(token);
  if (!loaded) return <div className="mx-auto max-w-md px-4 py-12"><h1>Convite não encontrado</h1><p className="mt-2 text-ink-soft">Confira o link recebido ou peça um novo convite.</p></div>;
  const ctx = await getCtx();
  const { inv, org, status } = loaded;
  const cls = inv.classIds.length ? await db.select({ name: classes.name }).from(classes).where(inArray(classes.id, inv.classIds)) : [];
  const accept = acceptInviteAction.bind(null, token);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1>Convite para {org?.name}</h1>
      <dl className="card mt-6 space-y-2 text-sm">
        <div><dt className="label">Escola</dt><dd>{org?.name}</dd></div>
        <div><dt className="label">Papel</dt><dd>{ROLE_LABEL[inv.role as keyof typeof ROLE_LABEL]}</dd></div>
        {cls.length > 0 && <div><dt className="label">Turmas</dt><dd>{cls.map((c) => c.name).join(", ")}</dd></div>}
        <div><dt className="label">Convidado</dt><dd>{inv.email}</dd></div>
        <div><dt className="label">Situação</dt><dd><span className="badge">{status === "pending" ? "pendente" : status === "accepted" ? "aceito" : status === "revoked" ? "revogado" : "expirado"}</span></dd></div>
      </dl>
      {status !== "pending" ? <p className="card-amber mt-4">{STATUS[status]}</p> : ctx ? (
        <Form action={async () => { "use server"; return accept(); }} className="mt-4">
          <p className="hint mb-3">Você está logado como {ctx.user.email}. Só será concedido o acesso às turmas e funções atribuídas.</p>
          <SubmitButton>Aceitar convite</SubmitButton>
        </Form>
      ) : (
        <div className="mt-4 flex gap-3">
          <Link className="btn" href={`/criar-conta?invite=${token}`}>Criar conta e aceitar</Link>
          <Link className="btn btn-ghost" href={`/entrar?next=/convite/${token}`}>Já tenho conta</Link>
        </div>
      )}
    </div>
  );
}
