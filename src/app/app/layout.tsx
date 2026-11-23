import Link from "next/link";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { logoutAction, resendVerificationAction } from "@/lib/auth-actions";
import { switchOrgAction } from "./actions";
import { ROLE_LABEL } from "@/lib/core/permissions";
import { SubmitButton } from "@/components/form";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const [n] = await db.select({ c: count() }).from(notifications).where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));
  const role = ctx.org.role;
  const items = [
    { href: "/app", label: "Início", icon: "⌂" },
    ...(role !== "admin" ? [
      { href: "/app/provas", label: "Provas", icon: "✎" },
      { href: "/app/banco", label: "Banco de questões", icon: "❖" },
      { href: "/app/turmas", label: "Turmas", icon: "☷" },
    ] : [{ href: "/app/turmas", label: "Turmas", icon: "☷" }]),
    { href: "/app/documentos", label: "Coordenação", icon: "☰" },
    { href: "/app/comunidade", label: "Comunidade", icon: "✉" },
    { href: "/app/materiais", label: "Materiais", icon: "▤" },
    ...(ctx.org.kind === "school" && (role === "admin" || role === "coordinator") ? [{ href: "/app/escola", label: "Escola", icon: "⌂" }] : []),
    ...(ctx.org.kind === "personal" ? [{ href: "/app/escola", label: "Modelos e regras", icon: "⚙" }] : []),
    ...(ctx.user.isStaff ? [{ href: "/admin", label: "Área interna", icon: "⚙" }] : []),
  ];
  return (
    <div className="min-h-screen bg-[radial-gradient(60rem_30rem_at_100%_-10%,#DCE7FF_0%,transparent_60%)] md:grid md:grid-cols-[250px_1fr]">
      <aside className="no-print border-b border-white/70 bg-gradient-to-b from-[#EAF0FF]/90 to-[#F5F8FF]/80 p-3 backdrop-blur-xl md:sticky md:top-0 md:h-screen md:overflow-y-auto md:border-b-0 md:border-r md:p-4">
        <div className="mb-3 flex items-center justify-between md:mb-6"><Logo href="/app" /></div>
        <form action={switchOrgAction} className="mb-3">
          <label htmlFor="org" className="hint">Escola ativa · <span id="org-role">{ROLE_LABEL[role]}</span></label>
          <div className="mt-1 flex items-center gap-2 md:block">
            <select id="org" name="orgId" defaultValue={ctx.org.id} className="input min-w-0 flex-1" aria-describedby="org-role">
              {ctx.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.kind === "personal" ? " (pessoal)" : ""}</option>)}
            </select>
            <button className="link-btn shrink-0" type="submit">Trocar</button>
          </div>
        </form>
        <NavLinks items={items} />
        <div className="mt-6 hidden text-sm md:block">
          <Link className="nav-link" href="/app/plano">☑ Plano e cobrança</Link>
          <Link className="nav-link" href="/app/conta">☺ Minha conta{n?.c ? ` (${n.c})` : ""}</Link>
          <Link className="nav-link" href="/app/ajuda">? Ajuda</Link>
          <form action={logoutAction}><button className="nav-link w-full text-left" type="submit">↩ Sair</button></form>
        </div>
      </aside>
      <div className="min-w-0">
        {!ctx.user.emailVerifiedAt && (
          <div className="no-print card-amber m-4 flex flex-wrap items-center justify-between gap-2 text-sm" role="status">
            <span>Confirme seu e-mail ({ctx.user.email}) para proteger sua conta.</span>
            <form action={resendVerificationAction}><SubmitButton className="link-btn">Reenviar link</SubmitButton></form>
          </div>
        )}
        <div id="conteudo" className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
        <nav className="no-print flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm md:hidden" aria-label="Conta">
          <Link href="/app/plano">Plano</Link><Link href="/app/conta">Minha conta</Link><Link href="/app/ajuda">Ajuda</Link>
          <form action={logoutAction}><button className="link-btn" type="submit">Sair</button></form>
        </nav>
      </div>
    </div>
  );
}
