import "server-only";
import type { ImagemBaixada } from "@/lib/core/deck";

/**
 * Fotos livres para as apresentações, buscadas no Wikimedia Commons (só licenças que permitem uso com atribuição:
 * domínio público, CC0, CC BY e CC BY-SA). O crédito da foto vai junto e aparece no slide. Sem rede ou sem resultado, devolve null
 * e o slide usa uma ilustração geométrica do tema.
 */
const UA = "SegundaLousaBot/1.0 (apresentacoes escolares)";
const LICENCA_OK = /public domain|domínio público|cc0|^cc[ -]by(?!.*(nc|nd))/i;
const semHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

type Pagina = { imageinfo?: { thumburl?: string; url?: string; mime?: string; width?: number; extmetadata?: Record<string, { value?: string }> }[] };

export async function buscarImagem(busca: string, timeoutMs = 9000): Promise<ImagemBaixada | null> {
  if (process.env.IMAGENS_DESLIGADAS === "1") return null;
  const base = process.env.IMAGENS_API_URL ?? "https://commons.wikimedia.org/w/api.php";
  try {
    const q = new URL(base);
    for (const [k, v] of Object.entries({ action: "query", format: "json", generator: "search", gsrnamespace: "6", gsrsearch: `${busca} filetype:bitmap`, gsrlimit: "10", prop: "imageinfo", iiprop: "url|mime|size|extmetadata", iiurlwidth: "1280" })) q.searchParams.set(k, v);
    const r = await fetch(q, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    const j = (await r.json()) as { query?: { pages?: Record<string, Pagina> } };
    const candidatos = Object.values(j.query?.pages ?? {}).map((p) => p.imageinfo?.[0]).filter((i): i is NonNullable<typeof i> => !!i)
      .filter((i) => /^image\/(jpeg|png)$/.test(i.mime ?? "") && (i.width ?? 0) >= 800 && !!(i.thumburl ?? i.url) && LICENCA_OK.test(i.extmetadata?.LicenseShortName?.value ?? ""));
    for (const c of candidatos.slice(0, 3)) {
      const img = await fetch(c.thumburl ?? c.url!, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(timeoutMs) }).catch(() => null);
      if (!img?.ok) continue;
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length < 5_000 || buf.length > 2_500_000) continue;
      const mime = c.mime === "image/png" ? "image/png" : "image/jpeg";
      const autor = semHtml(c.extmetadata?.Artist?.value ?? "autor desconhecido").slice(0, 60);
      return { dataUrl: `${mime};base64,${buf.toString("base64")}`, credito: `Foto: ${autor} / Wikimedia Commons / ${semHtml(c.extmetadata?.LicenseShortName?.value ?? "licença livre")}` };
    }
    return null;
  } catch { return null; }
}

/** Baixa as imagens pedidas em paralelo, com tempo total limitado (a apresentação nunca espera mais que isso). */
export async function baixarImagens(pedidos: { chave: string; busca: string }[], orcamentoMs = 15000): Promise<Record<string, ImagemBaixada>> {
  const out: Record<string, ImagemBaixada> = {};
  const tarefa = Promise.all(pedidos.map(async (p) => { const i = await buscarImagem(p.busca); if (i) out[p.chave] = i; }));
  await Promise.race([tarefa, new Promise((res) => setTimeout(res, orcamentoMs))]);
  return { ...out };
}
