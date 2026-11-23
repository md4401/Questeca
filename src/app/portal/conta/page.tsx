import { requirePortal } from "@/lib/portal";
import { ROLE_LABEL } from "@/lib/core/permissions";
import { portalDeletionAction } from "./actions";
import { logoutAction } from "@/lib/auth-actions";
export const metadata = { title: "Meu perfil" };
export default async function PortalConta() {
  const { ctx, students } = await requirePortal();
  return (
    <div className="max-w-xl space-y-6">
      <h1>Meu perfil</h1>
      <section className="card"><p><strong>{ctx.user.name}</strong></p><p className="hint">{ctx.user.email} · {ROLE_LABEL[ctx.org.role]}</p>
        <p className="mt-2 text-sm">Estudantes vinculados: {students.map((s) => s.name).join(", ")}</p></section>
      <section className="card"><h2 className="mb-1 text-lg">Privacidade</h2><p className="hint mb-3">Você pode pedir exportação ou exclusão dos seus dados.</p>
        <form action={portalDeletionAction}><button className="btn btn-ghost" type="submit">Solicitar exclusão ou exportação</button></form></section>
      <form action={logoutAction}><button className="btn btn-ghost" type="submit">Sair</button></form>
    </div>
  );
}
