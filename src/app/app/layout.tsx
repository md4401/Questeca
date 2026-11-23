import Link from "next/link";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { Logo, LogoMark } from "@/components/logo";
import { NavLinks } from "@/components/nav";
import { MobileTabs } from "@/components/mobile-tabs";
import { ThemeSync } from "@/components/theme";
import { Icon, type IconName } from "@/components/icons";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { logoutAction, resendVerificationAction } from "@/lib/auth-actions";
import { switchOrgAction } from "./actions";
import { ROLE_LABEL, isPortalRole } from "@/lib/core/permissions";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/form";
import { unreadMessages } from "@/lib/chat";

type Item = { href: string; label: string; icon: IconName };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  if (isPortalRole(ctx.org.role)) redirect("/portal");
  const [n] = await db.select({ c: count() }).from(notifications).where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));
  const unread = Number(n?.c ?? 0);
  const msgs = await unreadMessages(ctx.user.id);
  const role = ctx.org.role;
  const items: Item[] = [
    { href: "/app", label: "Início", icon: "home" },
    ...(role !== "admin" ? [
      { href: "/app/provas", label: "Provas", icon: "prova" as const },
      { href: "/app/banco", label: "Banco de questões", icon: "banco" as const },
      { href: "/app/turmas", label: "Turmas", icon: "turmas" as const },
    ] : [{ href: "/app/turmas", label: "Turmas", icon: "turmas" as const }]),
    { href: "/app/agenda", label: "Agenda", icon: "agenda" },
    { href: "/app/chat", label: `Mensagens${msgs ? ` (${msgs})` : ""}`, icon: "chat" },
    { href: "/app/moderacao", label: "Moderação", icon: "interno" },
    { href: "/app/documentos", label: "Coordenação", icon: "coord" },
    { href: "/app/comunidade", label: "Comunidade", icon: "chat" },
    { href: "/app/materiais", label: "Materiais", icon: "material" },
    { href: "/app/videoaulas", label: "Videoaulas", icon: "video" },
    ...(ctx.org.kind === "school" && (role === "admin" || role === "coordinator") ? [{ href: "/app/escola", label: "Escola", icon: "escola" as const }, { href: "/app/gestao", label: "Gestão acadêmica", icon: "turmas" as const }] : []),
    ...(ctx.org.kind === "personal" ? [{ href: "/app/escola", label: "Modelos e regras", icon: "ajustes" as const }] : []),
    ...(ctx.user.isStaff ? [{ href: "/admin", label: "Área interna", icon: "interno" as const }] : []),
  ];
  // Celular: quatro destinos principais ao alcance do polegar; o resto em "Mais".
  const tabs: Item[] = role === "admin"
    ? [{ href: "/app", label: "Início", icon: "home" }, { href: "/app/turmas", label: "Turmas", icon: "turmas" }, { href: "/app/documentos", label: "Coordenação", icon: "coord" }]
    : [{ href: "/app", label: "Início", icon: "home" }, { href: "/app/provas", label: "Provas", icon: "prova" }, { href: "/app/turmas", label: "Turmas", icon: "turmas" }];
  const tabHrefs = new Set(tabs.map((t) => t.href));
  const more: Item[] = [
    ...items.filter((i) => !tabHrefs.has(i.href)),
    { href: "/app/notificacoes", label: `Notificações${unread ? ` (${unread})` : ""}`, icon: "sino" },
    { href: "/app/plano", label: "Plano e cobrança", icon: "plano" },
    { href: "/app/conta", label: `Minha conta${unread ? ` (${unread})` : ""}`, icon: "conta" },
    { href: "/app/ajuda", label: "Ajuda", icon: "ajuda" },
  ];
  const place = ctx.org.city ? `${ctx.org.city}/${ctx.org.uf}` : ROLE_LABEL[role];

  return (
    <div className="min-h-screen bg-[radial-gradient(60rem_30rem_at_100%_-10%,#DCE7FF_0%,transparent_60%)] md:grid md:grid-cols-[250px_1fr]">
      <ThemeSync theme={ctx.user.prefs?.theme} large={!!ctx.user.prefs?.largeFont} />
      {/* celular: barra superior compacta */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/70 bg-white/95 px-4 pb-2 pt-[calc(.5rem+env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
        <Link href="/app" aria-label="Questeca — início" className="inline-flex items-center gap-2 no-underline">
          <LogoMark size={30} /><span className="display text-lg font-extrabold text-ink">Questeca</span>
        </Link>
        <p className="min-w-0 truncate text-right text-xs leading-tight text-ink-soft"><span className="block truncate font-semibold text-ink">{ctx.org.name}</span>{place}</p>
      </header>

      {/* desktop: barra lateral */}
      <aside className="no-print hidden border-white/70 bg-gradient-to-b from-[#EAF0FF]/90 to-[#F5F8FF]/80 p-4 backdrop-blur-xl md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto md:border-r">
        <div className="mb-6"><Logo href="/app" /></div>
        <form action={switchOrgAction} className="mb-3">
          <label htmlFor="org" className="hint">Escola ativa · <span id="org-role">{ROLE_LABEL[role]}</span></label>
          <div className="mt-1">
            <select id="org" name="orgId" defaultValue={ctx.org.id} className="input min-w-0" aria-describedby="org-role">
              {ctx.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.kind === "personal" ? " (pessoal)" : ""}</option>)}
            </select>
            <button className="link-btn mt-1" type="submit">Trocar</button>
          </div>
        </form>
        <NavLinks items={items} />
        <div className="mt-6 text-sm">
          <Link className="nav-link" href="/app/notificacoes"><Icon name="sino" size={20} />Notificações{unread ? ` (${unread})` : ""}</Link>
          <Link className="nav-link" href="/app/plano"><Icon name="plano" size={20} />Plano e cobrança</Link>
          <Link className="nav-link" href="/app/conta"><Icon name="conta" size={20} />Minha conta{unread ? ` (${unread})` : ""}</Link>
          <Link className="nav-link" href="/app/ajuda"><Icon name="ajuda" size={20} />Ajuda</Link>
          <form action={logoutAction}><button className="nav-link w-full text-left" type="submit"><Icon name="sair" size={20} />Sair</button></form>
        </div>
      </aside>

      <div className="min-w-0">
        {!ctx.user.emailVerifiedAt && (
          <div className="no-print card-amber m-4 flex flex-wrap items-center justify-between gap-2 text-sm" role="status">
            <span>Confirme seu e-mail ({ctx.user.email}) para proteger sua conta.</span>
            <form action={resendVerificationAction}><SubmitButton className="link-btn">Reenviar link</SubmitButton></form>
          </div>
        )}
        <div id="conteudo" className="mx-auto max-w-6xl p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-8">{children}</div>
      </div>

      <MobileTabs tabs={tabs} more={more} orgs={ctx.orgs.map((o) => ({ id: o.id, name: o.name, kind: o.kind }))} activeOrgId={ctx.org.id} roleLabel={ROLE_LABEL[role]} switchOrg={switchOrgAction} logout={logoutAction} unread={unread} />
    </div>
  );
}
