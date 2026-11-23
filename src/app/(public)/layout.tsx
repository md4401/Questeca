import Link from "next/link";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/session";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
          <Logo />
          <nav aria-label="Principal" className="hidden items-center gap-1 text-sm font-medium lg:flex">
            {[["/#como-funciona", "Como funciona"], ["/#recursos", "Recursos"], ["/#planos", "Planos"], ["/escolas", "Para escolas"]].map(([h, l]) => (
              <Link key={h} href={h} className="rounded-lg px-3 py-2 text-ink no-underline transition-colors hover:bg-brand-tint hover:text-brand-dark">{l}</Link>))}
          </nav>
          <div className="flex items-center gap-2">
            <details className="group lg:hidden">
              <summary aria-label="Abrir menu" className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-lg border border-line bg-white text-ink [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="relative block h-3 w-4"><span className="absolute inset-x-0 top-0 h-0.5 rounded bg-current transition-transform group-open:translate-y-[5px] group-open:rotate-45" /><span className="absolute inset-x-0 top-[5px] h-0.5 rounded bg-current group-open:opacity-0" /><span className="absolute inset-x-0 top-[10px] h-0.5 rounded bg-current transition-transform group-open:-translate-y-[5px] group-open:-rotate-45" /></span>
              </summary>
              <nav aria-label="Menu" className="fixed inset-x-3 top-[4rem] z-50 rounded-xl border border-line bg-white p-2 shadow-xl">
                {[["/#como-funciona", "Como funciona"], ["/#recursos", "Recursos"], ["/#planos", "Planos"], ["/escolas", "Para escolas"], ["/ajuda", "Ajuda"], ...(s ? [] : [["/criar-conta", "Criar conta"], ["/entrar", "Entrar"]])].map(([h, l]) => (
                  <Link key={h} href={h} className="block min-h-[44px] rounded-xl px-4 py-3.5 text-base font-medium text-ink no-underline hover:bg-brand-tint">{l}</Link>))}
              </nav>
            </details>
            {s ?<Link className="btn btn-sm" href="/app">Abrir Questeca</Link> : (
              <>
                <Link className="btn btn-ghost btn-sm !min-h-[44px] !min-w-[44px]" href="/entrar">Entrar</Link>
                <Link className="btn btn-sm hidden !min-h-[44px] whitespace-nowrap md:inline-flex" href="/criar-conta">Criar conta</Link>
              </>)}
          </div>
        </div>
      </header>
      <main id="conteudo">{children}</main>
      <footer className="relative mt-16 border-t border-line bg-white">
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
