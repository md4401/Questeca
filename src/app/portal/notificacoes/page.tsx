import { requirePortal } from "@/lib/portal";
import { NotificationCenter } from "@/components/notification-center";
export const metadata = { title: "Notificações" };
export default async function Page({ searchParams }: { searchParams: Promise<{ cat?: string; nao?: string; aluno?: string }> }) {
  const sp = await searchParams;
  const { ctx } = await requirePortal(sp.aluno);
  return <NotificationCenter ctx={ctx} base="/portal/notificacoes" sp={sp} />;
}
