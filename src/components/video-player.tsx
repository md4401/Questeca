import { embedUrl } from "@/lib/core/chat";
/** Vídeo incorporado só de YouTube (sem cookies) ou Vimeo; qualquer outro link abre em nova aba. */
export function VideoPlayer({ url, title }: { url: string; title: string }) {
  const src = embedUrl(url);
  if (!src) return <p className="card-tint"><a href={url} target="_blank" rel="noreferrer noopener">Abrir a videoaula em nova aba</a></p>;
  return <div className="aspect-video overflow-hidden rounded-2xl border border-line bg-black"><iframe src={src} title={title} className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" loading="lazy" /></div>;
}
