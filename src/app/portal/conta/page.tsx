import { requirePortal } from "@/lib/portal";
import { ROLE_LABEL } from "@/lib/core/permissions";
import { portalDeletionAction } from "./actions";
import { logoutAction } from "@/lib/auth-actions";
import { db } from "@/db";
import { userAvatars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AvatarForm } from "@/components/avatar-form";
import { ThemePicker, ThemeSync } from "@/components/theme";
import { Form, Field, SubmitButton } from "@/components/form";
import { savePortalProfileAction } from "@/lib/profile-actions";
import Link from "next/link";
export const metadata = { title: "Meu perfil" };
export default async function PortalConta() {
  const { ctx, students } = await requirePortal();
  const [av] = await db.select({ at: userAvatars.updatedAt }).from(userAvatars).where(eq(userAvatars.userId, ctx.user.id)).limit(1);
  const p = ctx.user.prefs ?? {};
  return (
    <div className="max-w-xl space-y-6">
      <h1>Meu perfil</h1>
      <section className="card"><p><strong>{ctx.user.name}</strong></p><p className="hint">{ctx.user.email} · {ROLE_LABEL[ctx.org.role]}</p>
        <p className="mt-2 text-sm">Estudantes vinculados: {students.map((s) => s.name).join(", ")}</p></section>
      <ThemeSync theme={p.theme} />
      <section className="card"><h2 className="mb-2 text-lg">Seus dados</h2>
        <Form action={savePortalProfileAction} toast><Field label="Nome" name="name" defaultValue={ctx.user.name} required />
          <label className="mb-3 flex gap-2 font-normal"><input type="checkbox" name="largeFont" defaultChecked={!!p.largeFont} />Fonte maior</label><SubmitButton>Salvar</SubmitButton></Form></section>
      <AvatarForm userId={ctx.user.id} name={ctx.user.name} has={!!av} v={av?.at.getTime()} />
      <section className="card"><ThemePicker initial={p.theme ?? "light"} /><p className="hint mt-2">Escolha quais avisos receber na <Link href="/portal/notificacoes">central de avisos</Link>.</p></section>
      <section className="card"><h2 className="mb-1 text-lg">Privacidade</h2><p className="hint mb-3">Você pode pedir exportação ou exclusão dos seus dados.</p>
        <form action={portalDeletionAction}><button className="btn btn-ghost" type="submit">Solicitar exclusão ou exportação</button></form></section>
      <form action={logoutAction}><button className="btn btn-ghost" type="submit">Sair</button></form>
    </div>
  );
}
