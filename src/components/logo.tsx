import Link from "next/link";

/** Marca: a bolha preenchida do cartão-resposta com o "Q". */
export function Logo({ href = "/", light }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2 no-underline">
      <span aria-hidden className="relative grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#4C7BFF] to-brand text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_18px_-8px_rgba(31,79,224,.9)] transition-transform duration-300 group-hover:scale-105">
        <span className="display text-lg font-extrabold leading-none">Q</span>
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#8DB6FF]" />
      </span>
      <span className={`display text-xl font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>Questeca</span>
    </Link>
  );
}
