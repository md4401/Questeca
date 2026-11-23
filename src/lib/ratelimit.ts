import "server-only";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/** Limite por janela fixa, persistido no banco (funciona em serverless). Retorna true se permitido. */
export async function rateLimit(key: string, max: number, windowSec: number) {
  const rows = await db.execute(sql`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
    returning count`);
  const count = Number((rows.rows[0] as { count: number }).count);
  return count <= max;
}
