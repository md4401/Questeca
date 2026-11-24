import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { Marca } from "@/components/marca";
import { totais } from "@/lib/catalogo";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: { default: "Provas e Gabaritos — ENEM, Fuvest, Unicamp e mais", template: "%s · Provas e Gabaritos" },
  description: "Baixe provas e gabaritos oficiais de vestibulares e exames, uma instituição por vez. Os arquivos vêm direto do site de cada banca.",
  applicationName: "Provas e Gabaritos",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1F4FE0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const t = totais();
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip" href="#conteudo">Pular para o conteúdo</a>
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5">
            <Marca />
            <nav aria-label="Principal" className="flex flex-wrap items-center text-sm font-semibold">
              <Link className="rounded-full px-2 py-2 no-underline hover:bg-brand-tint" href="/">Instituições</Link>
              <Link className="rounded-full px-2 py-2 no-underline hover:bg-brand-tint" href="/buscar">Buscar</Link>
              <Link className="rounded-full px-2 py-2 no-underline hover:bg-brand-tint" href="/cobertura">Cobertura</Link>
              <Link className="rounded-full px-2 py-2 no-underline hover:bg-brand-tint" href="/sobre">Sobre</Link>
            </nav>
          </div>
        </header>
        <main id="conteudo" className="mx-auto max-w-6xl px-4 pb-16 pt-8">{children}</main>
        <footer className="border-t border-line bg-white">
          <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-sm text-ink-soft">
            <p><strong className="text-ink">Provas e Gabaritos</strong> · {t.instituicoes} instituições · {t.edicoes} edições · {t.arquivos} arquivos</p>
            <p>As provas e os gabaritos pertencem às respectivas instituições. Este site organiza os links e leva você ao arquivo no site oficial; não altera nem hospeda o conteúdo. <Link href="/sobre">Como funciona e direitos autorais</Link>.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
