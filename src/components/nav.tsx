"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

type NavItem = { href: string; label: string; icon: IconName };
export function NavLinks({ groups }: { groups: { label?: string; items: NavItem[] }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Principal">
      {groups.filter((g) => g.items.length).map((g, gi) => (
        <div key={g.label ?? gi} className="nav-group" role="group" aria-label={g.label}>
          {g.label && <p className="nav-label" aria-hidden>{g.label}</p>}
          <div className="flex flex-col gap-0.5">
            {g.items.map((i) => {
              const active = i.href === "/app" ? path === "/app" : path.startsWith(i.href);
              return (
                <Link key={i.href} href={i.href} className="nav-link shrink-0 whitespace-nowrap" aria-current={active ? "page" : undefined}>
                  <Icon name={i.icon} size={18} /><span>{i.label}</span>
                </Link>
              );
            })}
          </div>
        </div>))}
    </nav>
  );
}

export function TabLinks({ base, tabs }: { base: string; tabs: { slug: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="tabs" role="navigation" aria-label="Seções">
      {tabs.map((t) => {
        const href = t.slug ? `${base}/${t.slug}` : base;
        const active = t.slug ? path.startsWith(href) : path === base;
        return <Link key={t.slug || "root"} href={href} className="tab" aria-current={active ? "page" : undefined}>{t.label}</Link>;
      })}
    </div>
  );
}
