import { TOPICS, extractTopics as ext, normalize } from "@/lib/taxonomy";
export { normalize };
export const extractTopics = (text: string) => ext(text).map((t) => ({ ...t, name: TOPICS.find((x) => x.slug === t.slug)!.name }));
