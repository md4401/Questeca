"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string; icon: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:mx-0 md:flex-col md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
      {items.map((i) => {
        const active = i.href === "/app" ? path === "/app" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className="nav-link shrink-0 whitespace-nowrap" aria-current={active ? "page" : undefined}>
            <span aria-hidden>{i.icon}</span><span>{i.label}</span>
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
