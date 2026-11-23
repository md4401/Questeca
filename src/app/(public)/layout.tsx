import Link from "next/link";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/session";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <>
      <header className="sticky top-0 z-50 px-3 pt-3">
        <div className="glass mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full !bg-white/90 px-3 py-2 md:px-4">
          <Logo />
          <nav aria-label="Principal" className="hidden items-center gap-1 text-sm font-medium lg:flex">
            {[["/#como-funciona", "Como funciona"], ["/#recursos", "Recursos"], ["/#planos", "Planos"], ["/escolas", "Para escolas"]].map(([h, l]) => (
              <Link key={h} href={h} className="rounded-full px-3 py-2 text-ink no-underline transition-colors hover:bg-white hover:text-brand-dark">{l}</Link>))}
          </nav>
          <div className="flex items-center gap-2">
            {s ? <Link className="btn btn-sm" href="/app">Abrir Questeca</Link> : (
              <>
                <Link className="btn btn-glass btn-sm" href="/entrar">Entrar</Link>
                <Link className="btn btn-sm" href="/criar-conta">Criar conta</Link>
              </>)}
          </div>
        </div>
      </header>
      <main id="conteudo">{children}</main>
      <footer className="relative mt-24 border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-ink-soft">Provas com questões reais, alinhadas ao que a turma estudou. Feito para professores do 6º ano ao Ensino Médio.</p>
          </div>
          <nav aria-label="Produto" className="flex flex-col gap-2 text-sm"><p className="font-bold">Produto</p><Link href="/#como-funciona">Como funciona</Link><Link href="/planos">Planos</Link><Link href="/escolas">Para escolas</Link><Link href="/ajuda">Ajuda</Link></nav>
          <nav aria-label="Rodapé" className="flex flex-col gap-2 text-sm"><p className="font-bold">Institucional</p><Link href="/ajuda#contato">Contato</Link><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/acessibilidade">Acessibilidade</Link></nav>
        </div>
        <p className="border-t border-line py-5 text-center text-xs text-ink-soft">© {new Date().getFullYear()} Questeca · Dados de alunos nunca são usados para treinar modelos.</p>
      </footer>
    </>
  );
}
