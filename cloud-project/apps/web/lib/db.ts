import { Pool } from "pg";
import { env } from "./env";

const globalForPool = globalThis as unknown as { pool?: Pool };

export const db =
  globalForPool.pool ??
  new Pool({
    connectionString: env.databaseUrl
  });

if (!globalForPool.pool) {
  globalForPool.pool = db;
}
