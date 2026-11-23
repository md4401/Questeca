import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function make() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  // Em ambientes com proxy restrito, aponta o endpoint HTTP para o host do próprio banco.
  const host = new URL(url).host;
  if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${host}/sql`;
  return drizzle(neon(url), { schema });
}

let _db: ReturnType<typeof make> | undefined;
export function getDb() {
  return (_db ??= make());
}
export const db = new Proxy({} as ReturnType<typeof make>, {
  get(_t, p) {
    return Reflect.get(getDb(), p);
  },
});
export { schema };
