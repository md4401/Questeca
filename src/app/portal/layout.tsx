import Link from "next/link";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireAnyCtx } from "@/lib/session";
import { isPortalRole, ROLE_LABEL } from "@/lib/core/permissions";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { MobileTabs } from "@/components/mobile-tabs";
import { Icon } from "@/components/icons";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { logoutAction } from "@/lib/auth-actions";
import { switchOrgAction } from "@/app/app/actions";
import { PORTAL_NAV } from "@/lib/portal-nav";
import { unreadMessages } from "@/lib/chat";

export const metadata = { title: { default: "Portal", template: "%s · Portal Questeca" } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAnyCtx();
  if (!isPortalRole(ctx.org.role)) redirect("/app");
  const [n] = await db.select({ c: count() }).from(notifications).where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));
  const unread = Number(n?.c ?? 0);
  const msgs = await unreadMessages(ctx.user.id);
  const items = PORTAL_NAV.map((i) => (i.href === "/portal/chat" && msgs ? { ...i, label: `Mensagens (${msgs})` } : i)).filter((i) => !i.roles || i.roles.includes(ctx.org.role as "student" | "guardian"));
  const tabs = items.slice(0, 3); const more = [...items.slice(3), { href: "/portal/conta", label: "Meu perfil", icon: "conta" as const }];
  return (
    <div className="min-h-screen bg-[radial-gradient(60rem_30rem_at_100%_-10%,#DCE7FF_0%,transparent_60%)]">
      <header className="no-print sticky top-0 z-30 border-b border-white/70 bg-white/95 px-4 pb-2 pt-[calc(.5rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/portal" aria-label="Questeca — portal" className="inline-flex items-center gap-2 no-underline"><LogoMark size={30} /><span className="display text-lg font-extrabold text-ink">Questeca</span></Link>
          <nav aria-label="Portal" className="hidden items-center gap-1 md:flex">
            {items.map((i) => <Link key={i.href} href={i.href} className="nav-link !py-1.5"><Icon name={i.icon} size={18} />{i.label}{i.href === "/portal/notificacoes" && unread ? ` (${unread})` : ""}</Link>)}
            <Link href="/portal/conta" className="nav-link !py-1.5"><Icon name="conta" size={18} />Perfil</Link>
            <form action={logoutAction}><button className="nav-link !py-1.5" type="submit"><Icon name="sair" size={18} />Sair</button></form>
          </nav>
          <p className="min-w-0 truncate text-right text-xs leading-tight text-ink-soft md:hidden"><span className="block truncate font-semibold text-ink">{ctx.org.name}</span>{ROLE_LABEL[ctx.org.role]}</p>
        </div>
      </header>
      <div id="conteudo" className="mx-auto max-w-5xl p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-8">{children}</div>
      <MobileTabs tabs={tabs} more={more} orgs={ctx.orgs.map((o) => ({ id: o.id, name: o.name, kind: o.kind }))} activeOrgId={ctx.org.id} roleLabel={ROLE_LABEL[ctx.org.role]} switchOrg={switchOrgAction} logout={logoutAction} unread={unread} />
    </div>
  );
}
