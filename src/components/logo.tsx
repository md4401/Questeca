import Link from "next/link";

type Tone = "brand" | "light" | "mono";
const TONES: Record<Tone, { ring: string; ribbon: string }> = {
  brand: { ring: "var(--color-brand, #1F4FE0)", ribbon: "var(--color-ink, #0A1A3F)" },
  light: { ring: "#7FA6FF", ribbon: "#FFFFFF" },
  mono: { ring: "currentColor", ribbon: "currentColor" },
};

/** Símbolo: anel do "Q" (bolha do cartão-resposta) com uma fita de marcador de página como cauda. Legível a 16 px. */
export function LogoMark({ size = 36, tone = "brand", className }: { size?: number; tone?: Tone; className?: string }) {
  const t = TONES[tone];
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className={className} focusable="false">
      <mask id="qs-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="#fff" />
        <path d="M24.2 29.2h13.6v19.3l-6.8-5.6-6.8 5.6z" fill="#000" stroke="#000" strokeWidth="2.4" strokeLinejoin="round" />
      </mask>
      <circle cx="22" cy="22" r="15.5" fill="none" style={{ stroke: t.ring }} strokeWidth="7" mask="url(#qs-cut)" />
      <path d="M26.4 30h9v14.4l-4.5-3.7-4.5 3.7z" style={{ fill: t.ribbon }} />
    </svg>
  );
}

export function Logo({ href = "/", light, size = 36 }: { href?: string; light?: boolean; size?: number }) {
  return (
    <Link href={href} aria-label="Segunda Lousa — início" className="group inline-flex items-center gap-2 no-underline">
      <LogoMark size={size} tone={light ? "light" : "brand"} className="transition-transform duration-300 group-hover:scale-105" />
      <span className={`logo-text display text-xl font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>Segunda Lousa</span>
    </Link>
  );
}
