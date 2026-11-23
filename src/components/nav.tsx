"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

export function NavLinks({ items }: { items: { href: string; label: string; icon: IconName }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {items.map((i) => {
        const active = i.href === "/app" ? path === "/app" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className="nav-link shrink-0 whitespace-nowrap" aria-current={active ? "page" : undefined}>
            <Icon name={i.icon} size={20} /><span>{i.label}</span>
          </Link>
        );
      })}
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
