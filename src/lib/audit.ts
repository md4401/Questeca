import "server-only";
import { db } from "@/db";
import { auditLog, events, notifications } from "@/db/schema";

export async function audit(actorId: string | null, orgId: string | null, action: string, target?: string, meta?: unknown) {
  try { await db.insert(auditLog).values({ actorId, orgId, action, target, meta: meta as object }); } catch (e) { console.error("audit falhou", e); }
}
export async function track(name: string, userId?: string | null, orgId?: string | null, meta?: unknown) {
  try { await db.insert(events).values({ name, userId, orgId, meta: meta as object }); } catch { /* métrica nunca quebra fluxo */ }
}
export async function notify(userId: string, category: "seguranca" | "pagamento" | "correcao" | "comunidade" | "sistema", title: string, body?: string, href?: string) {
  try { await db.insert(notifications).values({ userId, category, title, body, href }); } catch { /* idem */ }
}
