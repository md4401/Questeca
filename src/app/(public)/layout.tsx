import Link from "next/link";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/session";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <nav aria-label="Principal" className="flex flex-wrap items-center gap-2 text-sm">
            <Link className="px-2 py-1 font-medium" href="/#como-funciona">Como funciona</Link>
            <Link className="px-2 py-1 font-medium" href="/planos">Planos</Link>
            <Link className="px-2 py-1 font-medium" href="/escolas">Para escolas</Link>
            {s ? <Link className="btn btn-sm" href="/app">Abrir Questeca</Link> : (
              <>
                <Link className="btn btn-ghost btn-sm" href="/entrar">Entrar</Link>
                <Link className="btn btn-sm" href="/criar-conta">Criar conta</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="conteudo">{children}</main>
      <footer className="mt-16 border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-6 px-4 py-8 text-sm text-ink-soft">
          <div>
            <Logo />
            <p className="mt-2 max-w-xs">Provas com questões reais, alinhadas ao que a turma estudou.</p>
          </div>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/ajuda">Ajuda</Link>
            <Link href="/ajuda#contato">Contato</Link>
            <Link href="/termos">Termos de uso</Link>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/acessibilidade">Acessibilidade</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
