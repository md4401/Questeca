import "server-only";
import { aiAvailable, transcribeImage } from "@/lib/ai";

const MAX = 4_000_000;

/** Extrai texto de PDF, DOCX, TXT/MD ou (com IA) foto. Retorna texto ou erro legível. */
export async function extractTextFromFile(f: File): Promise<{ text: string } | { error: string }> {
  if (f.size === 0) return { error: "Arquivo vazio." };
  if (f.size > MAX) return { error: "Arquivo muito grande (máximo 4 MB)." };
  const name = f.name.toLowerCase();
  const buf = Buffer.from(await f.arrayBuffer());
  try {
    if (name.endsWith(".pdf") || f.type === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      const t = (Array.isArray(text) ? text.join("\n") : text).trim();
      if (t.length < 20) return { error: "Não foi possível ler texto neste PDF (parece ser digitalizado). Cole o texto ou envie uma foto." };
      return { text: t };
    }
    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: buf });
      if (value.trim().length < 5) return { error: "O DOCX não tem texto legível." };
      return { text: value.trim() };
    }
    if (name.endsWith(".txt") || name.endsWith(".md") || f.type.startsWith("text/")) return { text: buf.toString("utf8").trim() };
    if (/\.(png|jpe?g|webp)$/.test(name) || f.type.startsWith("image/")) {
      if (!aiAvailable()) return { error: "Leitura de fotos exige um provedor de IA configurado. Por enquanto, cole o texto ou envie PDF/DOCX." };
      return { text: await transcribeImage(buf.toString("base64"), f.type || "image/jpeg") };
    }
  } catch (e) {
    return { error: `Não foi possível ler o arquivo (${e instanceof Error ? e.message : "erro"}).` };
  }
  return { error: "Formato não suportado. Use PDF, DOCX, TXT ou foto." };
}
