import "server-only";
import { db } from "@/db";
import { and, eq, isNull } from "drizzle-orm";
import { auditLog, events, notifications, users } from "@/db/schema";

export async function audit(actorId: string | null, orgId: string | null, action: string, target?: string, meta?: unknown) {
  try { await db.insert(auditLog).values({ actorId, orgId, action, target, meta: meta as object }); } catch (e) { console.error("audit falhou", e); }
}
export async function track(name: string, userId?: string | null, orgId?: string | null, meta?: unknown) {
  try { await db.insert(events).values({ name, userId, orgId, meta: meta as object }); } catch { /* métrica nunca quebra fluxo */ }
}
export type NotifyCategory = "seguranca" | "pagamento" | "correcao" | "comunidade" | "sistema" | "nota" | "frequencia" | "tarefa" | "evento" | "mensagem" | "conquista";
export const NOTIFY_LABEL: Record<NotifyCategory, string> = { seguranca: "Segurança", pagamento: "Pagamento", correcao: "Correção", comunidade: "Comunidade", sistema: "Sistema", nota: "Notas", frequencia: "Frequência", tarefa: "Tarefas", evento: "Eventos", mensagem: "Mensagens", conquista: "Conquistas" };
/** Categorias que o usuário não pode silenciar. */
const ALWAYS: NotifyCategory[] = ["seguranca", "pagamento"];

/**
 * Cria uma notificação respeitando as preferências por categoria e agrupando equivalentes:
 * se já existe uma não lida com a mesma `groupKey`, só atualiza o contador e o texto (sem duplicar).
 * O conteúdo deve ser genérico (sem dados sensíveis); quem abre o `href` passa de novo pela autorização da página.
 */
export async function notify(userId: string, category: NotifyCategory, title: string, body?: string, href?: string, opts: { groupKey?: string; priority?: "normal" | "high" } = {}) {
  try {
    const [u] = await db.select({ prefs: users.prefs }).from(users).where(eq(users.id, userId)).limit(1);
    const muted = (u?.prefs?.mute ?? []) as string[];
    if (muted.includes(category) && !ALWAYS.includes(category) && opts.priority !== "high") return;
    if (opts.groupKey) {
      const [ex] = await db.select({ id: notifications.id, count: notifications.count }).from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.groupKey, opts.groupKey), isNull(notifications.readAt))).limit(1);
      if (ex) { await db.update(notifications).set({ count: ex.count + 1, title, body, href, createdAt: new Date() }).where(eq(notifications.id, ex.id)); return; }
    }
    await db.insert(notifications).values({ userId, category, title, body, href, groupKey: opts.groupKey, priority: opts.priority ?? "normal" });
  } catch { /* idem */ }
}
