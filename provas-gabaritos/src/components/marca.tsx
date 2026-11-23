import Link from "next/link";
/** Marca: uma folha de prova com o visto de gabarito. */
export function Marca() {
  return (
    <Link href="/" aria-label="Provas e Gabaritos — início" className="inline-flex items-center gap-2 no-underline">
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden focusable="false"><rect x="4" y="2" width="24" height="28" rx="5" fill="#1F4FE0" /><path d="M10 12h12M10 17h7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /><path d="M16.5 23.2l2.8 2.8 5.2-6" fill="none" stroke="#9DC0FF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span className="whitespace-nowrap font-[family-name:var(--font-display)] text-base font-extrabold tracking-tight text-ink sm:text-lg">Provas e Gabaritos</span>
    </Link>
  );
}
