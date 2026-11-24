"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Modal } from "@/components/ui/modal";

type Item = { href: string; label: string; icon: IconName };
type Org = { id: string; name: string; kind: string };

/** Navegação inferior no celular: ações no alcance do polegar. "Mais" abre o restante em uma folha. */
export function MobileTabs({ tabs, more, orgs, activeOrgId, roleLabel, switchOrg, logout, unread }: {
  tabs: Item[]; more: Item[]; orgs: Org[]; activeOrgId: string; roleLabel: string;
  switchOrg: (fd: FormData) => void | Promise<void>; logout: () => void | Promise<void>; unread: number;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));
  const moreActive = more.some((m) => isActive(m.href));
  return (
    <>
      <nav aria-label="Navegação principal" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map((t) => (
            <li key={t.href}>
              <Link href={t.href} aria-current={isActive(t.href) ? "page" : undefined} className="tab-item">
                <Icon name={t.icon} /><span>{t.label}</span>
              </Link>
            </li>))}
          <li>
            <button type="button" className="tab-item w-full" aria-haspopup="dialog" aria-current={moreActive ? "true" : undefined} onClick={() => setOpen(true)}>
              <span className="relative"><Icon name="mais" />{unread > 0 && <i className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-danger" aria-label={`${unread} avisos`} />}</span><span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>
      <Modal solid open={open} onClose={() => setOpen(false)} title="Mais">
        <ul className="grid gap-1" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
          {more.map((m) => (
            <li key={m.href}><Link href={m.href} className="sheet-link"><Icon name={m.icon} /><span>{m.label}</span></Link></li>))}
        </ul>
        {orgs.length > 1 && (
          <form action={switchOrg} className="mt-4 border-t border-line pt-4">
            <label htmlFor="org-m" className="hint">Escola ativa · {roleLabel}</label>
            <div className="mt-1 flex gap-2">
              <select id="org-m" name="orgId" defaultValue={activeOrgId} className="input min-w-0 flex-1">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.kind === "personal" ? " (pessoal)" : ""}</option>)}</select>
              <button className="btn btn-ghost" type="submit">Trocar</button>
            </div>
          </form>)}
        <form action={logout} className="mt-3"><button type="submit" className="sheet-link w-full"><Icon name="sair" /><span>Sair</span></button></form>
      </Modal>
    </>
  );
}
