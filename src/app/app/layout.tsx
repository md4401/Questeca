import Link from "next/link";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { Logo, LogoMark } from "@/components/logo";
import { NavLinks } from "@/components/nav";
import { MobileTabs } from "@/components/mobile-tabs";
import { ThemeSync, ThemeToggle } from "@/components/theme";
import { Icon, type IconName } from "@/components/icons";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { logoutAction, resendVerificationAction } from "@/lib/auth-actions";
import { switchOrgAction } from "./actions";
import { ROLE_LABEL } from "@/lib/core/permissions";
import { SubmitButton } from "@/components/form";
import { unreadMessages } from "@/lib/chat";

type Item = { href: string; label: string; icon: IconName };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const [n] = await db.select({ c: count() }).from(notifications).where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));
  const unread = Number(n?.c ?? 0);
  const msgs = await unreadMessages(ctx.user.id);
  const role = ctx.org.role;
  const teacherLike = role !== "admin";
  const groups: { label?: string; items: Item[] }[] = [
    { items: [{ href: "/app", label: "Início", icon: "home" }] },
    { label: "Sala de aula", items: [
      { href: "/app/turmas", label: "Turmas", icon: "turmas" },
      ...(teacherLike ? [{ href: "/app/planos-de-aula", label: "Planos de aula", icon: "material" as const }] : []),
      { href: "/app/agenda", label: "Agenda", icon: "agenda" },
    ] },
    ...(teacherLike ? [{ label: "Avaliações", items: [
      { href: "/app/provas", label: "Provas", icon: "prova" as const },
      { href: "/app/banco", label: "Banco de questões", icon: "banco" as const },
      { href: "/app/escanear", label: "Escanear cartão", icon: "chamada" as const },
    ] }, { label: "Acompanhamento", items: [
      { href: "/app/radar", label: "Radar de alunos", icon: "nota" as const },
      { href: "/app/chat", label: `Mensagens${msgs ? ` (${msgs})` : ""}`, icon: "chat" as const },
    ] }] : [{ label: "Acompanhamento", items: [{ href: "/app/chat", label: `Mensagens${msgs ? ` (${msgs})` : ""}`, icon: "chat" as const }] }]),
    { label: "Escola e comunidade", items: [
      { href: "/app/documentos", label: "Coordenação", icon: "coord" },
      { href: "/app/comunidade", label: "Comunidade", icon: "chat" },
      { href: "/app/materiais", label: "Materiais", icon: "material" },
      { href: "/app/moderacao", label: "Moderação", icon: "interno" },
      ...(ctx.org.kind === "school" && (role === "admin" || role === "coordinator") ? [{ href: "/app/escola", label: "Escola", icon: "escola" as const }, { href: "/app/gestao", label: "Gestão acadêmica", icon: "turmas" as const }] : []),
      ...(ctx.org.kind === "personal" ? [{ href: "/app/escola", label: "Modelos e regras", icon: "ajustes" as const }] : []),
      ...(ctx.user.isStaff ? [{ href: "/admin", label: "Área interna", icon: "interno" as const }] : []),
    ] },
  ];
  const items: Item[] = groups.flatMap((g) => g.items);
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
    <div className="app-shell min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <ThemeSync theme={ctx.user.prefs?.theme} large={!!ctx.user.prefs?.largeFont} />
      {/* celular: barra superior compacta */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-4 pb-2 pt-[calc(.5rem+env(safe-area-inset-top))] backdrop-blur md:hidden">
        <Link href="/app" aria-label="Questeca — início" className="inline-flex items-center gap-2 no-underline">
          <LogoMark size={28} /><span className="text-lg font-bold text-ink">Questeca</span>
        </Link>
        <p className="min-w-0 truncate text-right text-xs leading-tight text-ink-soft"><span className="block truncate font-semibold text-ink">{ctx.org.name}</span>{place}</p>
      </header>

      {/* desktop: barra lateral */}
      <aside className="side no-print hidden flex-col p-3 md:sticky md:top-0 md:flex md:h-screen md:overflow-hidden">
        <div className="mb-4 px-2 pt-1"><Logo href="/app" /></div>
        {ctx.orgs.length > 1 ? (
          <form action={switchOrgAction} className="mb-4 px-1">
            <label htmlFor="org" className="hint">Escola ativa · <span id="org-role">{ROLE_LABEL[role]}</span></label>
            <div className="mt-1 flex items-center gap-1">
              <select id="org" name="orgId" defaultValue={ctx.org.id} className="input min-w-0 !min-h-[36px] !py-1 text-sm" aria-describedby="org-role">
                {ctx.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.kind === "personal" ? " (pessoal)" : ""}</option>)}
              </select>
              <button className="link-btn" type="submit">Trocar</button>
            </div>
          </form>
        ) : (
          <div className="mb-4 rounded-lg bg-[#F4F6FB] px-3 py-2 text-sm"><p className="truncate font-semibold">{ctx.org.name}</p><p className="hint">{ROLE_LABEL[role]}{ctx.org.city ? ` · ${ctx.org.city}/${ctx.org.uf}` : ""}</p></div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1"><NavLinks groups={groups} /></div>
        <div className="mt-4 border-t border-line pt-3 text-sm">
          <Link className="nav-link" href="/app/notificacoes"><Icon name="sino" size={18} />Notificações{unread ? ` (${unread})` : ""}</Link>
          <Link className="nav-link" href="/app/plano"><Icon name="plano" size={18} />Plano e cobrança</Link>
          <Link className="nav-link" href="/app/ajuda"><Icon name="ajuda" size={18} />Ajuda</Link>
          <Link className="user-chip mt-2" href="/app/conta">
            <span className="avatar" aria-hidden>{ctx.user.name.trim().slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0"><span className="block truncate font-semibold">{ctx.user.name}</span><span className="hint block truncate">Minha conta{unread ? ` (${unread})` : ""}</span></span>
          </Link>
          <ThemeToggle />
          <form action={logoutAction}><button className="nav-link w-full text-left" type="submit"><Icon name="sair" size={18} />Sair</button></form>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="topbar no-print hidden md:flex">
          <p className="min-w-0 truncate text-sm text-ink-soft">{ctx.org.name} · {ROLE_LABEL[role]}</p>
          <div className="flex items-center gap-1">
            <Link href="/app/banco" className="icon-btn" aria-label="Buscar no banco de questões"><Icon name="busca" size={20} /></Link>
            <Link href="/app/notificacoes" className="icon-btn relative" aria-label={`Avisos${unread ? ` (${unread} não lidos)` : ""}`}><Icon name="sino" size={20} />{unread > 0 && <i className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-danger" aria-hidden />}</Link>
          </div>
        </div>
        {!ctx.user.emailVerifiedAt && (
          <div className="no-print slim-note" role="status">
            <span>Confirme seu e-mail ({ctx.user.email}) para proteger sua conta.</span>
            <form action={resendVerificationAction}><SubmitButton className="link-btn">Reenviar link</SubmitButton></form>
          </div>
        )}
        <div id="conteudo" className="mx-auto max-w-6xl p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-10 md:py-8">{children}</div>
      </div>

      <MobileTabs tabs={tabs} more={more} orgs={ctx.orgs.map((o) => ({ id: o.id, name: o.name, kind: o.kind }))} activeOrgId={ctx.org.id} roleLabel={ROLE_LABEL[role]} switchOrg={switchOrgAction} logout={logoutAction} unread={unread} />
    </div>
  );
}
