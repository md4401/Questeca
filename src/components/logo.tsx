import Link from "next/link";
export function Logo({ href = "/", light }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 no-underline" aria-label="Questeca — início">
      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-brand text-white font-serif text-xl font-semibold">Q</span>
      <span className={`font-serif text-xl font-semibold ${light ? "text-white" : "text-brand"}`}>Questeca</span>
    </Link>
  );
}
