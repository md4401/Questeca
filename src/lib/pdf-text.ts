import "server-only";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export async function renderTextDocument(o: { school: string; title: string; body: string; footer: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f = (pkg: string, file: string) => fs.readFileSync(path.join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file));
  const sans = await doc.embedFont(f("dm-sans", "dm-sans-latin-400-normal.woff"), { subset: true });
  const bold = await doc.embedFont(f("dm-sans", "dm-sans-latin-700-normal.woff"), { subset: true });
  const serif = await doc.embedFont(f("spectral", "spectral-latin-400-normal.woff"), { subset: true });
  const set = new Set(serif.getCharacterSet());
  const clean = (t: string) => [...t.normalize("NFC")].map((c) => (c === "\n" ? c : set.has(c.codePointAt(0)!) ? c : c === "•" ? "-" : "?")).join("");
  const W = 595.28, H = 841.89, M = 56;
  let page = doc.addPage([W, H]); let y = H - M;
  const line = (t: string, font = serif, size = 11) => {
    for (const para of clean(t).split("\n")) {
      let cur = "";
      const words = para.split(/\s+/);
      const flush = () => { if (y < M + 20) { page = doc.addPage([W, H]); y = H - M; } y -= size + 3; page.drawText(cur, { x: M, y, size, font, color: rgb(0, 0, 0) }); cur = ""; };
      if (!para.trim()) { y -= size; continue; }
      for (const w of words) { const test = cur ? `${cur} ${w}` : w; if (font.widthOfTextAtSize(test, size) <= W - 2 * M) cur = test; else { flush(); cur = w; } }
      if (cur) flush();
    }
  };
  line(o.school, bold, 14); y -= 4; line(o.title, bold, 16); y -= 8; line(o.body);
  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`${clean(o.footer)} · Página ${i + 1} de ${pages.length}`, { x: M, y: 30, size: 8, font: sans, color: rgb(0.35, 0.35, 0.35) }));
  return doc.save();
}
