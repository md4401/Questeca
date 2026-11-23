import { requireCtx } from "@/lib/session";
import { NotificationCenter } from "@/components/notification-center";
export const metadata = { title: "Notificações" };
export default async function Page({ searchParams }: { searchParams: Promise<{ cat?: string; nao?: string }> }) {
  return <NotificationCenter ctx={await requireCtx()} base="/app/notificacoes" sp={await searchParams} />;
}
