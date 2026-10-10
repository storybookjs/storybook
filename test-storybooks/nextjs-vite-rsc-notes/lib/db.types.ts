import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import type { PgliteQueryResultHKT } from "drizzle-orm/pglite/session";
import type * as schema from "#db/schema.ts";

export type DB = PgDatabase<PgliteQueryResultHKT | NeonQueryResultHKT, typeof schema>;
