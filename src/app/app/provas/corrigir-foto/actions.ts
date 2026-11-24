"use server";
import { requireCtx } from "@/lib/session";
import { corrigirDiscursiva, aiAvailable } from "@/lib/ai";
import { SemCreditos } from "@/lib/credits";
import { rateLimit } from "@/lib/ratelimit";

export type ResultadoCorrecao = { error?: string; ok?: boolean; transcricao?: string; nota?: number; comentario?: string; legivel?: boolean; pontos?: number };

/** Foto da resposta manuscrita → transcrição + nota sugerida + comentário. Nada é gravado: o professor confere e lança a nota onde quiser. */
export async function corrigirFotoAction(_: ResultadoCorrecao | null, fd: FormData): Promise<ResultadoCorrecao> {
  const ctx = await requireCtx();
  const f = fd.get("foto");
  const enunciado = String(fd.get("enunciado") ?? "").trim().slice(0, 2000);
  const criterio = String(fd.get("criterio") ?? "").trim().slice(0, 2000);
  const pontos = Math.min(100, Math.max(0.25, Number(String(fd.get("pontos") ?? "1").replace(",", ".")) || 1));
  if (!enunciado || !criterio) return { error: "Preencha o enunciado e o critério de correção." };
  if (!(f instanceof File) || f.size === 0) return { error: "Escolha a foto da resposta." };
  if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) return { error: "Use uma foto PNG, JPG ou WebP." };
  if (f.size > 4_000_000) return { error: "Foto muito grande (máximo 4 MB)." };
  if (!aiAvailable()) return { error: "A GizIA não está ativada nesta instalação." };
  if (!(await rateLimit(`corrigir-foto:${ctx.user.id}`, 60, 3600))) return { error: "Muitas correções seguidas. Tente de novo em alguns minutos." };
  try {
    const r = await corrigirDiscursiva(Buffer.from(await f.arrayBuffer()).toString("base64"), f.type, { enunciado, criterio, pontos });
    return { ok: true, ...r, pontos };
  } catch (e) { return { error: e instanceof SemCreditos ? "Seus créditos de IA de hoje acabaram." : "Não consegui ler a foto agora. Tente com mais luz e a folha reta." }; }
}
