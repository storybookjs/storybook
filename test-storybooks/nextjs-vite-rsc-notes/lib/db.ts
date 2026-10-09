import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { pushSchema } from "drizzle-kit/api";
import ws from "ws";
import * as schema from "#db/schema.ts";
import { env } from "#env/server.ts";
import { applyScenario } from "#lib/db.scenarios.ts";
import type { DB } from "#lib/db.types.ts";

let db: DB;

if (env.DATABASE_URL) {
  db = drizzle({
    connection: env.DATABASE_URL,
    ws,
    schema,
  });
} else {
  const client = await PGlite.create("memory://");
  const migrationDb = drizzlePglite(client);
  const { apply } = await pushSchema(schema, migrationDb);
  await apply();

  const pgliteDb = drizzlePglite(client, { schema });
  await applyScenario(pgliteDb, env.SCENARIO);
  db = pgliteDb;
}

export { db };
