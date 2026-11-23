import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");
if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${new URL(url).host}/sql`;
await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
console.log("migrações aplicadas");
