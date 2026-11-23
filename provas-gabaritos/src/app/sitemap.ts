import type { MetadataRoute } from "next";
import { instituicoes } from "@/lib/catalogo";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${BASE}/`, changeFrequency: "weekly" }, { url: `${BASE}/buscar` }, { url: `${BASE}/sobre` }, ...instituicoes.map((i) => ({ url: `${BASE}/instituicao/${i.slug}`, changeFrequency: "weekly" as const }))];
}
