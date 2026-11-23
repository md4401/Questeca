import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { Logo } from "@/components/logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <div>
      <header className="border-b border-line bg-brand-tint"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><div className="flex items-center gap-3"><Logo href="/app" /><span className="badge badge-amber">Área interna</span></div><Link href="/app" className="text-sm">Voltar ao app</Link></div></header>
      <main id="conteudo" className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
    </div>
  );
}
