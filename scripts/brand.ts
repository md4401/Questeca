/** Gera os arquivos de marca (SVG, nome em curvas) em public/brand e o ícone do app. Uso: pnpm tsx scripts/brand.ts */
import fontkit from "@pdf-lib/fontkit";
import { readFileSync, writeFileSync } from "node:fs";

const font = fontkit.create(readFileSync("node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff"));

/** Símbolo: anel do "Q" (a bolha do cartão-resposta) + fita de marcador de página como cauda. */
export function symbol(ring: string, ribbon: string) {
  return `<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48"><rect width="48" height="48" fill="#fff"/><path d="M24.2 29.2h13.6v19.3l-6.8-5.6-6.8 5.6z" fill="#000" stroke="#000" stroke-width="2.4" stroke-linejoin="round"/></mask>
<circle cx="22" cy="22" r="15.5" fill="none" stroke="${ring}" stroke-width="7" mask="url(#cut)"/>
<path d="M26.4 30h9v14.4l-4.5-3.7-4.5 3.7z" fill="${ribbon}"/>`;
}
const svg = (w: number, h: number, vb: string, body: string, title = "Segunda Lousa") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}" role="img"><title>${title}</title>${body}</svg>\n`;

function wordmark(fill: string, x: number, baseline: number, size: number) {
  const run = font.layout("Segunda Lousa");
  const scale = size / font.unitsPerEm;
  let cx = 0, d = "";
  for (let i = 0; i < run.glyphs.length; i++) {
    const g = run.glyphs[i]; const pos = run.positions[i];
    d += `<path transform="translate(${(x + (cx + pos.xOffset) * scale).toFixed(2)} ${baseline}) scale(${scale} ${-scale})" d="${g.path.toSVG()}"/>`;
    cx += pos.xAdvance;
  }
  return { body: `<g fill="${fill}">${d}</g>`, width: cx * scale };
}

const BRAND = "#1F4FE0", INK = "#0A1A3F", SKY = "#7FA6FF", WHITE = "#FFFFFF";
const variants: Record<string, { ring: string; ribbon: string; text: string }> = {
  "": { ring: BRAND, ribbon: INK, text: INK },
  "-dark-bg": { ring: SKY, ribbon: WHITE, text: WHITE },
  "-mono-dark": { ring: INK, ribbon: INK, text: INK },
  "-mono-light": { ring: WHITE, ribbon: WHITE, text: WHITE },
};
for (const [suf, v] of Object.entries(variants)) {
  writeFileSync(`public/brand/segunda-lousa-symbol${suf}.svg`, svg(96, 96, "0 0 48 48", symbol(v.ring, v.ribbon)));
  const wm = wordmark(v.text, 56, 34, 30);
  writeFileSync(`public/brand/segunda-lousa-logo${suf}.svg`, svg(Math.ceil(56 + wm.width + 2) * 2, 96, `0 0 ${Math.ceil(56 + wm.width + 2)} 48`, symbol(v.ring, v.ribbon) + wm.body));
}
// Favicon: símbolo sobre fundo arredondado, traço mais grosso para 16 px.
writeFileSync("src/app/icon.svg", svg(64, 64, "0 0 64 64", `<rect width="64" height="64" rx="14" fill="${BRAND}"/><g transform="translate(6 6) scale(.875)">${symbol(WHITE, WHITE).replace('stroke-width="7"', 'stroke-width="8"')}</g>`));
console.log("marca gerada");
